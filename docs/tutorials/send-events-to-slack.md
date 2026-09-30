---
id: send-events-to-slack
title: "Tutorial: send events to Slack"
sidebar_label: Send events to Slack
sidebar_position: 4
description: Post a Slack message for each Voltstream event, using a small receiver and a Slack incoming webhook.
---

# Send events to Slack

Slack cannot verify a Voltstream signature. Slack also doesn't return responses
in a form Voltstream's retry logic understands. So don't register a Slack URL as
an endpoint directly. Put a small receiver in between. The receiver verifies
each delivery, formats a message, and posts it to a Slack incoming webhook.

This tutorial builds that receiver. About 15 minutes.

## Prerequisites

- A Voltstream stream and an API key. See the [quickstart](../getting-started/quickstart.md).
- Permission to add apps to your Slack workspace.
- Node.js 18 or later.

## 1. Create a Slack incoming webhook

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
   from scratch in your workspace.
2. Open **Incoming Webhooks** and turn on **Activate Incoming Webhooks**.
3. Click **Add New Webhook to Workspace**, pick the channel, and click **Allow**.
4. Copy the webhook URL. It starts with `https://hooks.slack.com/services/`.

Treat the webhook URL as a secret. Anyone who has it can post to your channel.

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T000/B000/XXXX"
```

## 2. Write the receiver

The receiver verifies the signature and acknowledges the delivery right away.
Then it posts to Slack.

```js title="slack-forwarder.js"
import express from 'express';
import { verify } from '@voltstream/sdk';

const app = express();

app.post(
  '/webhooks',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    let event;
    try {
      event = verify(req.body, req.headers['voltstream-signature'], process.env.VOLTSTREAM_WEBHOOK_SECRET);
    } catch {
      return res.status(400).send('bad signature');
    }

    // Acknowledge first. Voltstream retries anything that does not
    // return 2xx within 10 seconds.
    res.status(204).end();

    postToSlack(event).catch((err) => console.error('slack post failed', err));
  },
);

async function postToSlack(event) {
  const res = await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `*${event.type}*\n\`\`\`${JSON.stringify(event.data, null, 2)}\`\`\``,
    }),
  });
  if (!res.ok) throw new Error(`Slack returned ${res.status}`);
}

app.listen(4000);
```

## 3. Register the receiver as an endpoint

For local testing, start the relay:

```bash
npx @voltstream/relay --forward http://localhost:4000/webhooks
```

Register the relay URL as an endpoint. In production, use your deployed receiver's
URL instead. Use `event_types` to keep the channel quiet. Only send the events
someone should actually read.

```bash
curl -X POST https://api.voltstream.io/v1/endpoints \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": "str_2n4Kx9Lm",
    "url": "https://relay.voltstream.io/r/7Qm2xK",
    "event_types": ["order.created", "refund.*"],
    "description": "Slack #orders"
  }'
```

Copy the `signing_secret` from the response. It is shown only once. Start the
receiver with it:

```bash
VOLTSTREAM_WEBHOOK_SECRET=whsec_... node slack-forwarder.js
```

## 4. Send a test event

```bash
curl -X POST https://api.voltstream.io/v1/events \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -H "Voltstream-Idempotency-Key: slack-test-001" \
  -d '{
    "stream_id": "str_2n4Kx9Lm",
    "type": "order.created",
    "data": { "order_id": "ord_88213", "amount_cents": 4999, "currency": "usd" }
  }'
```

The message appears in your Slack channel within a few seconds.

## 5. Avoid duplicate messages

Voltstream delivers at least once. So without deduplication, a retried delivery
posts the same message to Slack twice. Before you post, check the
`Voltstream-Event-Id` header against a store of events you've already posted,
and skip any repeats. See [Idempotency](../guides/idempotency.md) for the pattern.

## What to read next

- [Event filtering](../guides/event-filtering.md): narrow the channel to high-signal events with payload predicates.
- [Build a production consumer](./build-a-consumer.md): add durability so a crash doesn't drop a message.
