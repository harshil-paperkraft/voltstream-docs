---
id: intro
title: Introduction
sidebar_position: 1
slug: /
description: What Voltstream does, when to use it, and how the pieces fit together.
---

# Introduction

Voltstream is event delivery infrastructure. You publish events to a **stream**;
we deliver them to your subscribers' **endpoints** and keep retrying until they
arrive or you tell us to stop.

The hard parts of event delivery are not the happy path. They are retries that
do not stampede, ordering that survives a failover, replaying three days of
history without duplicating side effects, and proving to a customer that you
did in fact send the event they say they never got. Voltstream handles those.

## When to use it

Use Voltstream when you need to send events to systems you do not control —
customer webhooks, partner integrations, internal services across a network
boundary.

You probably do not need it for fire-and-forget telemetry, or for in-process
work where a job queue is simpler and cheaper.

## The three objects

| Object | What it is |
| --- | --- |
| **Stream** | A named channel you publish events to. Scoped to an environment. |
| **Event** | One immutable message. Has a type, a payload, and an idempotency key. |
| **Endpoint** | A subscriber URL. Receives events matching its filter, with retries. |

An event published to a stream fans out to every endpoint subscribed to it.
Each endpoint gets its own delivery attempt, its own retry schedule, and its
own failure state — one slow subscriber never blocks another.

## Delivery guarantees

Voltstream is **at-least-once**. An endpoint can receive the same event more
than once, and must be idempotent. See [Idempotency](./guides/idempotency.md)
for how to make that cheap.

Ordering is per-stream, per-endpoint, and only guaranteed while deliveries
succeed. A failing delivery holds its position for up to five minutes before
later events overtake it, so a single broken endpoint cannot stall a queue
indefinitely.

## Next steps

- [Quickstart](./getting-started/quickstart.md) — publish and receive your first event in about five minutes.
- [Authentication](./getting-started/authentication.md) — API keys, scopes and rotation.
- [Webhook delivery](./guides/webhook-delivery.md) — retries, backoff and signature verification.
- [API reference](./api/overview.md) — every endpoint.
