---
id: fan-out-to-many
title: "Tutorial: fan out to many subscribers"
sidebar_label: Fan out to many
sidebar_position: 3
description: One event, hundreds of customer endpoints, without one slow subscriber affecting the rest.
---

# Fan out to many subscribers

A platform with customer-configurable webhooks has a different problem from one
with a single partner: one event has hundreds of destinations, each with its own
URL, filter, secret and reliability.

This tutorial builds that, and covers the failure modes that only appear at fan-out
scale. About 30 minutes.

## Isolation is the whole point

Each endpoint has its own delivery attempt, retry schedule and health state. A
customer whose server is down gets retried and eventually disabled; every other
subscriber is unaffected and never notices.

You do not build this. It is what an endpoint *is*. The work is in modelling
your customers onto endpoints correctly.

## 1. One endpoint per customer destination

Do not create one endpoint and route inside your own service. That puts you back
in the delivery business.

```js title="src/webhooks.js"
export async function registerCustomerWebhook(customerId, url, eventTypes) {
  const endpoint = await vs.endpoints.create({
    streamId: process.env.VOLTSTREAM_STREAM_ID,
    url,
    eventTypes,
    // Filter to this customer's data — the endpoint never sees anyone else's.
    filter: { 'data.customer_id': { eq: customerId } },
    description: `customer:${customerId}`,
    metadata: { customer_id: customerId },
  });

  // The secret is returned once. Store it so the customer can retrieve it.
  await db`
    INSERT INTO customer_webhooks (customer_id, endpoint_id, signing_secret_encrypted)
    VALUES (${customerId}, ${endpoint.id}, ${encrypt(endpoint.signingSecret)})
  `;

  return endpoint;
}
```

:::danger The filter is not a security boundary
`data.customer_id` keeps normal traffic scoped, but a filter is one API call
from being changed. If your payloads contain data one customer must never see,
**do not put it in the payload** — publish per-customer events, or send an ID
the subscriber resolves through an authenticated API.
:::

## 2. Surface delivery state to the customer

The single biggest driver of "my webhook is broken" tickets is that the customer
cannot see what happened. Give them the delivery log.

```js
export async function recentDeliveries(customerId) {
  const { endpoint_id } = await db`
    SELECT endpoint_id FROM customer_webhooks WHERE customer_id = ${customerId}
  `.then((r) => r[0]);

  const deliveries = await vs.deliveries.list({ endpointId: endpoint_id, limit: 50 });

  return deliveries.map((d) => ({
    eventType: d.eventType,
    status: d.status,
    responseCode: d.responseCode,
    attempt: d.attempt,
    nextRetryAt: d.nextRetryAt,
    // Never expose our internal IDs or the signing secret.
    occurredAt: d.createdAt,
  }));
}
```

Let them re-send a single failed delivery themselves. It deflects a large share
of tickets.

## 3. Handle the disabled-endpoint event

When a customer's endpoint is auto-disabled, you want to tell them — not
discover it when they complain a month later.

```js
handlers['endpoint.disabled'] = async (tx, data) => {
  const customerId = data.metadata?.customer_id;
  if (!customerId) return;

  await tx`
    UPDATE customer_webhooks SET status = 'disabled', disabled_at = now()
    WHERE endpoint_id = ${data.endpoint_id}
  `;

  await notifyCustomer(customerId, {
    subject: 'Your webhook endpoint has been disabled',
    reason: data.reason,
    lastError: data.last_error,
    reenableUrl: `https://app.example.com/settings/webhooks`,
  });
};
```

Subscribe an internal endpoint to `endpoint.*` on a separate stream so these
never mix with customer traffic.

## 4. What to watch

| Metric | Why |
| --- | --- |
| Endpoints disabled in the last 24h | A spike usually means *you* shipped a breaking payload change |
| p99 delivery latency by endpoint | Finds the slow subscribers before they get disabled |
| Fan-out ratio | Events published vs deliveries attempted. A sudden rise means a filter got broader |
| Deliveries per customer | Catches a customer registering an endpoint that matches everything |

The first row is the one that matters most. If twenty customers' endpoints are
disabled in the same hour, the common factor is almost never twenty
simultaneous outages.

## 5. Scale notes

- **Fan-out is not free to you.** One publish, 500 endpoints, is 500
  deliveries — one event against quota, but 500 requests leaving our network.
  Check how your plan prices it.
- **Filters run before delivery.** A tight filter costs the subscriber nothing
  and does not count as a delivery.
- **Endpoints have a per-stream ceiling** — 10,000 on Business. Past that, split
  by region or tier across several streams.

## What to read next

- [Event filtering](../guides/event-filtering.md) — operators, and the missing-field trap.
- [Webhook delivery](../guides/webhook-delivery.md) — the health rules that disable an endpoint.
