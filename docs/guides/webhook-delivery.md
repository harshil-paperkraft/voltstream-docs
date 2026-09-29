---
id: webhook-delivery
title: Webhook delivery
sidebar_position: 1
description: What counts as success, the retry schedule, signature verification and endpoint health.
---

# Webhook delivery

## What counts as a success

Any `2xx` returned within **10 seconds**. Everything else is a failure and will
be retried:

| Response | Treated as | Retried |
| --- | --- | --- |
| `200`, `201`, `202`, `204` | Success | No |
| `3xx` | Failure — we do not follow redirects | Yes |
| `408`, `429`, `5xx` | Transient failure | Yes |
| `400`, `401`, `403`, `422` | Permanent failure | Yes, but counts double toward disabling |
| Timeout after 10s | Failure | Yes |
| TLS or DNS error | Failure | Yes |

We do not follow redirects on purpose: a redirect to a different host is
indistinguishable from a takeover, and following one would send a signed
customer payload somewhere the endpoint owner never registered.

## The retry schedule

Exponential backoff with full jitter, over roughly 24 hours:

| Attempt | Nominal delay |
| --- | --- |
| 1 | immediate |
| 2 | 10 s |
| 3 | 1 min |
| 4 | 5 min |
| 5 | 30 min |
| 6 | 2 h |
| 7 | 6 h |
| 8 | 12 h |

Jitter spreads each delay across a window, so a receiver that recovers from an
outage does not take a synchronised thundering herd from every event that
queued during it.

After attempt 8 the event is marked `undelivered`. It stays replayable for as
long as your plan's payload retention allows.

### Respecting Retry-After

A `429` or `503` with a `Retry-After` header overrides the schedule, up to a
maximum of 6 hours. This is the polite way to tell us to slow down, and it is
better than dropping requests.

## Signature verification

Every delivery carries:

```http
Voltstream-Signature: t=1790668462,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
Voltstream-Idempotency-Key: quickstart-001
Voltstream-Event-Id: evt_9Kd2mQ
Voltstream-Delivery-Attempt: 1
```

The signature is HMAC-SHA256 over `{timestamp}.{raw_body}`, keyed with the
endpoint's `whsec_` secret.

```js
import { verify } from '@voltstream/sdk';

const event = verify(rawBody, signatureHeader, process.env.VOLTSTREAM_WEBHOOK_SECRET);
```

Verifying by hand, if you are not using an SDK:

```python
import hmac, hashlib, time

def verify(raw_body: bytes, header: str, secret: str, tolerance: int = 300):
    parts = dict(p.split("=", 1) for p in header.split(","))
    timestamp, signature = parts["t"], parts["v1"]

    # Reject old timestamps, or a captured delivery can be replayed forever.
    if abs(time.time() - int(timestamp)) > tolerance:
        raise ValueError("timestamp outside tolerance")

    expected = hmac.new(
        secret.encode(),
        f"{timestamp}.".encode() + raw_body,
        hashlib.sha256,
    ).hexdigest()

    # Constant-time compare — a plain == leaks the signature byte by byte.
    if not hmac.compare_digest(expected, signature):
        raise ValueError("signature mismatch")

    return json.loads(raw_body)
```

Three things people get wrong here, in order of frequency:

1. **Using the parsed body.** Re-serialising JSON changes key order and
   whitespace, so the HMAC will not match. You need the raw bytes.
2. **Skipping the timestamp check.** Without it, anyone who captures one
   delivery can replay it indefinitely.
3. **Comparing with `==`.** Use a constant-time comparison.

## Endpoint health

An endpoint is **automatically disabled** after 20 consecutive failures or 24
hours of continuous failure, whichever comes first. You receive an email and an
`endpoint.disabled` event.

While disabled, matching events are still recorded — they are simply not
attempted. Re-enable it and replay the window to catch up:

```bash
voltstream endpoints enable ep_4Lm8x
voltstream events replay --endpoint ep_4Lm8x --since 2026-09-28T00:00:00Z
```

## Local development

Voltstream cannot reach `localhost`. The relay gives you a public URL that
forwards to your machine:

```bash
npx @voltstream/relay --forward http://localhost:4000/webhooks
```

The relay URL is stable for the life of the process. Restarting gives you a new
one unless you pass `--subdomain`:

```bash
npx @voltstream/relay --forward http://localhost:4000/webhooks --subdomain northwind-dev
```

:::caution
Relay URLs are for development. They are rate limited, disappear when the
process exits, and should never appear on a live endpoint.
:::
