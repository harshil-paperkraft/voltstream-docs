---
id: quickstart
title: Quickstart
sidebar_position: 1
description: Publish your first event and receive it on a local endpoint in about five minutes.
---

# Quickstart

By the end of this page you will have published an event and watched it arrive
on an endpoint you control. It takes about five minutes and needs no billing
details.

## 1. Get a test API key

Sign in and open **Settings → API keys**, then create a key in the **test**
environment. Test keys start `vs_test_` and can only touch test data, so it is
safe to use one while you are learning.

```bash
export VOLTSTREAM_KEY="vs_test_..."
```

:::caution
Never commit a key, and never use a `vs_live_` key in an example. Live keys can
publish real events to real customer endpoints.
:::

## 2. Create a stream

A stream is the channel you publish to.

```bash
curl -X POST https://api.voltstream.io/v1/streams \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "orders", "description": "Order lifecycle events"}'
```

```json title="Response"
{
  "id": "str_2n4Kx9Lm",
  "name": "orders",
  "description": "Order lifecycle events",
  "environment": "test",
  "created_at": "2026-09-29T09:14:22Z"
}
```

Keep `str_2n4Kx9Lm` — the next two steps need it.

## 3. Point an endpoint at your machine

You need a URL Voltstream can reach. For local development, start the relay:

```bash
npx @voltstream/relay --forward http://localhost:4000/webhooks
```

```text title="Output"
✔ Relay ready
  Public URL   https://relay.voltstream.io/r/7Qm2xK
  Forwarding   → http://localhost:4000/webhooks
```

Register that public URL as an endpoint on the stream:

```bash
curl -X POST https://api.voltstream.io/v1/endpoints \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": "str_2n4Kx9Lm",
    "url": "https://relay.voltstream.io/r/7Qm2xK",
    "event_types": ["order.*"]
  }'
```

The response includes a `signing_secret` starting `whsec_`. You need it in
step 5 — it is shown once and never again.

## 4. Publish an event

```bash
curl -X POST https://api.voltstream.io/v1/events \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -H "Voltstream-Idempotency-Key: quickstart-001" \
  -d '{
    "stream_id": "str_2n4Kx9Lm",
    "type": "order.created",
    "data": {
      "order_id": "ord_88213",
      "amount_cents": 4999,
      "currency": "usd"
    }
  }'
```

The relay prints the delivery within a second or two.

## 5. Verify the signature

Never trust an unverified webhook. Every delivery carries a
`Voltstream-Signature` header, which you check against the `whsec_` secret from
step 3.

```js title="server.js"
import express from 'express';
import { verify } from '@voltstream/sdk';

const app = express();

// The raw body is required — a parsed body will not match the signature.
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

    // Acknowledge first, work afterwards. Voltstream retries anything
    // that does not return 2xx within 10 seconds.
    res.status(204).end();

    handle(event).catch((err) => console.error('handler failed', err));
  },
);

app.listen(4000);
```

:::tip Acknowledge fast
Return 2xx as soon as you have durably accepted the event, then do the work.
A handler that finishes its job before replying will eventually exceed the
10-second timeout and be retried — producing exactly the duplicates you were
trying to avoid.
:::

## What to read next

- [Authentication](./authentication.md) — scopes, rotation and the two environments.
- [Webhook delivery](../guides/webhook-delivery.md) — the retry schedule and what counts as a failure.
- [Build a consumer](../tutorials/build-a-consumer.md) — a production-shaped receiver, start to finish.
