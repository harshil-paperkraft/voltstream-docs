---
id: rate-limits
title: Rate limits
sidebar_position: 4
description: The limits, the headers that report them, and how to back off correctly.
---

# Rate limits

Limits are per **environment**, not per API key — adding keys does not add
capacity.

| Plan | Publish | Read | Replay |
| --- | --- | --- | --- |
| Free | 100/s, burst 200 | 20/s | 1 concurrent |
| Team | 1,000/s, burst 2,000 | 100/s | 5 concurrent |
| Business | 10,000/s, burst 20,000 | 500/s | 25 concurrent |

Burst is a token bucket that refills at the sustained rate. A quiet minute buys
you one burst, not a rolling credit.

Outbound delivery is not rate limited by us. It is bounded by what the receiver
accepts — see [Webhook delivery](./webhook-delivery.md).

## Headers

Every response reports your position:

```http
Voltstream-RateLimit-Limit: 1000
Voltstream-RateLimit-Remaining: 847
Voltstream-RateLimit-Reset: 1790668462
```

On a `429` you also get:

```http
Retry-After: 2
```

Honour `Retry-After` rather than computing your own delay. It reflects the
actual bucket state, which your client cannot see.

## Backing off correctly

```js
async function publishWithRetry(event, maxAttempts = 5) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://api.voltstream.io/v1/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VOLTSTREAM_KEY}`,
        'Content-Type': 'application/json',
        // Same key across retries — the publish stays idempotent.
        'Voltstream-Idempotency-Key': event.idempotencyKey,
      },
      body: JSON.stringify(event),
    });

    if (res.status !== 429) return res;
    if (attempt >= maxAttempts) throw new Error('rate limited, gave up');

    const retryAfter = Number(res.headers.get('Retry-After') ?? 1);
    // Full jitter: without it, every client retries in lockstep.
    await sleep(Math.random() * retryAfter * 1000);
  }
}
```

The jitter is not optional at scale. A fleet that all sleeps exactly
`Retry-After` seconds reconverges on the same millisecond and gets limited
again.

## Staying under the limit

**Batch.** `POST /v1/events/batch` accepts up to 500 events and counts as one
request against the read/write rate, though each event still counts toward
quota.

```bash
curl -X POST https://api.voltstream.io/v1/events/batch \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"stream_id": "str_2n4Kx9Lm", "events": [ ... ]}'
```

**Do not poll for delivery status.** Subscribe to `delivery.*` events instead.
Polling `GET /v1/deliveries` in a loop is the most common way accounts exhaust
their read limit.

**Spread scheduled work.** If a nightly job publishes 200,000 events at exactly
02:00, it will burst-limit. Spread it, or use the batch endpoint.

## Quota is separate

Rate limits control requests per second. **Quota** is events per month, and
exhausting it returns `429 quota_exceeded` with no `Retry-After` — no amount of
waiting helps until the cycle resets or the plan changes.

Distinguish them by the error code in the body, not by the status.

```json
{
  "error": {
    "code": "quota_exceeded",
    "message": "Monthly event quota of 100000 reached. Resets 2026-10-01T00:00:00Z.",
    "docs_url": "https://docs.voltstream.io/docs/guides/rate-limits"
  }
}
```

## Requesting more

Limits can be raised on Team and Business. Email support@voltstream.io with
your environment ID and expected peak — a raise usually lands within a business
day, and there is no charge for a limit increase inside your plan's quota.
