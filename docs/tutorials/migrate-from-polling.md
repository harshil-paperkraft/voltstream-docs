---
id: migrate-from-polling
title: "Tutorial: migrate a partner from polling"
sidebar_label: Migrate from polling
sidebar_position: 2
description: Move an integration from a polling loop to events without a flag day, and without losing records.
---

# Migrate a partner from polling

Polling integrations are slow and expensive on both sides. Moving one to events
is straightforward; moving one *safely*, while it is live and someone else owns
the other end, needs a plan.

This tutorial runs both mechanisms side by side, proves they agree, and then
retires the poller. About 45 minutes of work, spread over a week of soak time.

## The shape of the problem

```text
Before   partner ──poll every 5 min──▶ GET /api/orders?since=…

After    you ──publish──▶ Voltstream ──deliver──▶ partner endpoint
```

You cannot switch atomically, because you do not control the partner's deploy.
So the sequence is: **add events → run both → compare → retire polling**.

## 1. Publish alongside the existing write path

Publish from the same transaction that makes the change. Not before — an event
for an order that then fails to commit is a lie.

```js title="src/orders.js"
export async function createOrder(input) {
  return db.begin(async (tx) => {
    const order = await tx`
      INSERT INTO orders (amount_cents, currency, status)
      VALUES (${input.amountCents}, ${input.currency}, 'created')
      RETURNING *
    `;

    // Outbox, not a direct API call: a publish inside a transaction that
    // later rolls back would emit an event for an order that never existed.
    await tx`
      INSERT INTO outbox (event_type, payload, idempotency_key)
      VALUES ('order.created', ${tx.json(order)}, ${`order-${order.id}-created`})
    `;

    return order;
  });
}
```

A separate relay drains the outbox:

```js title="src/outbox-relay.js"
import { Voltstream } from '@voltstream/sdk';
import { db } from './db.js';

const vs = new Voltstream({ apiKey: process.env.VOLTSTREAM_KEY });

async function drain() {
  const rows = await db`
    SELECT id, event_type, payload, idempotency_key FROM outbox
    WHERE published_at IS NULL
    ORDER BY id
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  `;

  for (const row of rows) {
    await vs.events.publish({
      streamId: process.env.VOLTSTREAM_STREAM_ID,
      type: row.event_type,
      data: row.payload,
      idempotencyKey: row.idempotency_key,
    });

    await db`UPDATE outbox SET published_at = now() WHERE id = ${row.id}`;
  }
}

setInterval(() => drain().catch(console.error), 500);
```

The idempotency key means a crash between publishing and marking the row is
harmless — the retry deduplicates.

## 2. Give the partner a test endpoint

Have them register against your **test** environment first, with the same
handler they will run in production.

```bash
curl -X POST https://api.voltstream.io/v1/endpoints \
  -H "Authorization: Bearer $VOLTSTREAM_TEST_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": "str_2n4Kx9Lm",
    "url": "https://partner.example.com/voltstream-test",
    "event_types": ["order.*"],
    "description": "Northwind — test"
  }'
```

Send them the `whsec_` secret over something that is not email.

## 3. Run both, and compare

This is the step people skip, and it is the only one that actually de-risks the
migration. For a week, the partner keeps polling *and* receives events, writing
each to a separate table. Then compare.

```sql title="Records the poller saw but events did not"
SELECT p.order_id
FROM polled_orders p
LEFT JOIN evented_orders e USING (order_id)
WHERE e.order_id IS NULL
  AND p.seen_at < now() - interval '10 minutes';
```

```sql title="And the reverse"
SELECT e.order_id
FROM evented_orders e
LEFT JOIN polled_orders p USING (order_id)
WHERE p.order_id IS NULL
  AND e.seen_at < now() - interval '10 minutes';
```

The 10-minute window matters — without it you will see phantom gaps that are
just the poller's interval.

Both queries returning zero for a full week is the go signal. Anything else is
a real bug, and it is almost always one of:

| Symptom | Usual cause |
| --- | --- |
| Events missing, polling has them | A write path that does not go through the outbox |
| Polling missing, events have them | The poller's `since` cursor skipping records on ties |
| Both miss the same records | The filter on the endpoint is too narrow |

## 4. Cut over

1. Partner registers a **live** endpoint and confirms deliveries arrive.
2. Partner reduces polling to hourly — a safety net, not a mechanism.
3. Soak for a week.
4. Partner stops polling.
5. You rate-limit, then remove, the polling route.

Keep the comparison queries running through step 4. They cost nothing and they
are how you find out that step 2 broke something.

## 5. After

Delete `polled_orders` once you are confident. Keep the outbox — it is now load
bearing, and it is what lets you replay if the partner ever needs to rebuild.

## Common questions

**The partner's endpoint went down during cutover. Did we lose records?**
No. Events accumulate for your payload retention window. Re-enable the endpoint
and [replay](../guides/replaying-events.md) the gap.

**Can we keep both permanently?**
You can, but the polling route stops being tested and quietly rots. Pick one.

**The partner wants a backfill of the last 6 months.**
Events only exist from when you started publishing. Backfill through your
existing API, then cut over to events for everything after a chosen timestamp.
