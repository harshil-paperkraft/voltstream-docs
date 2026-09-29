---
id: faq
title: FAQ
sidebar_position: 6
description: Short answers to the questions support gets most often.
---

# FAQ

## General

### How is Voltstream different from a message queue?

A queue assumes you control both ends. Voltstream assumes you do not: the
receiver is someone else's server, it goes down without warning, it returns
HTML when you expected JSON, and it needs a signature it can verify. The
retry, backoff, signing and replay machinery exists for that.

If both ends are yours and inside one network, a queue is simpler and cheaper.

### Is there a free tier?

Yes. 100,000 events per month, 3 streams, 10 endpoints and 7 days of history.
No card required. Rate limits are the same as on paid plans.

### Where is my data stored?

Event payloads and delivery history are stored in the region you pick when you
create the environment: `us-east`, `eu-west` or `ap-south`. Data does not leave
its region. The region cannot be changed after creation — create a new
environment and re-point your publishers.

### How long are events retained?

| Plan | Payload retention | Delivery log retention |
| --- | --- | --- |
| Free | 7 days | 30 days |
| Team | 30 days | 90 days |
| Business | 90 days | 1 year |

You can [replay](./guides/replaying-events.md) anything inside the payload
retention window. After that the delivery log still shows what happened, but
the payload is gone and cannot be replayed.

## Delivery

### An endpoint is receiving the same event twice. Is that a bug?

No — Voltstream is at-least-once by design. A duplicate means a delivery
succeeded but the acknowledgement was lost, so we retried. Make your handler
idempotent using the `Voltstream-Idempotency-Key` header; see
[Idempotency](./guides/idempotency.md).

### My endpoint is disabled. Why?

An endpoint is automatically disabled after **20 consecutive failures** or
**24 hours of continuous failure**, whichever comes first. This protects you
from burning your quota on a dead URL, and protects the receiver from a
retry storm.

You get an email and a `endpoint.disabled` event when it happens. Re-enable it
from the dashboard or with `POST /v1/endpoints/{id}/enable`. Events that
accumulated while it was disabled stay in the payload retention window and can
be replayed.

### Why did delivery order change?

Ordering holds while deliveries succeed. If a delivery fails, it keeps its
position for up to five minutes while it retries; after that, later events
overtake it. Without this, one broken endpoint would stall its queue forever.

If strict ordering matters more than throughput, set
`ordering: "strict"` on the endpoint. Deliveries then block on failure rather
than being overtaken — at the cost of head-of-line blocking.

### Can I send events to a URL that is not publicly reachable?

Not directly. Use the [Voltstream relay](./guides/webhook-delivery.md#local-development)
for local development, or give us a publicly reachable URL that forwards
internally.

## Limits and errors

### What are the rate limits?

Publishing is limited per environment, not per key. See
[Rate limits](./guides/rate-limits.md) for the numbers and for what to do when
you hit one.

### I am getting 401 on a key that worked yesterday.

Three common causes, in order of likelihood:

1. The key was rotated and the old one has passed its grace period.
2. You are using a test-environment key against the live API, or the reverse.
   Test keys start `vs_test_`, live keys start `vs_live_`.
3. The key's scopes were narrowed and no longer cover the call.

The error body names which one. See [Error codes](./api/errors.md).

### Do you have an SLA?

99.9% for publish availability on Team, 99.95% on Business, both measured
monthly. Delivery is best-effort by nature — we cannot guarantee someone else's
server is up — so the SLA covers accepting your events and attempting delivery
on schedule, not the receiver's behaviour.

## Billing

### What counts as an event?

One publish is one event, regardless of how many endpoints it fans out to.
Retries are free. Replays count as new events.

### What happens if I exceed my plan?

Publishing returns `429 quota_exceeded` and events are rejected rather than
queued. We email at 80% and 100%. Nothing is deleted, and delivery of
already-accepted events continues.
