---
id: replaying-events
title: Replaying events
sidebar_position: 5
description: Re-send history after an outage, a bug, or a new subscriber joining.
---

# Replaying events

A replay re-sends events that are inside your payload retention window. The
three reasons people reach for it:

- A receiver was down or broken, and needs to catch up.
- A handler had a bug, and the work needs redoing against fixed code.
- A new endpoint needs history, not just events from now on.

## Replaying one event

```bash
voltstream events replay evt_9Kd2mQ
```

```bash
curl -X POST https://api.voltstream.io/v1/events/evt_9Kd2mQ/replay \
  -H "Authorization: Bearer $VOLTSTREAM_KEY"
```

By default this re-sends to every endpoint that originally matched. Target one:

```bash
voltstream events replay evt_9Kd2mQ --endpoint ep_4Lm8x
```

## Replaying a window

```bash
voltstream events replay \
  --endpoint ep_4Lm8x \
  --since 2026-09-28T00:00:00Z \
  --until 2026-09-28T06:00:00Z \
  --types "order.*"
```

Always dry-run first. Replays count toward quota, and a mis-scoped window is
the expensive mistake here.

```bash
voltstream events replay --endpoint ep_4Lm8x --since 2026-09-28T00:00:00Z --dry-run
```

```text title="Output"
  Would replay 4,182 events to ep_4Lm8x
  Types        order.* (3,901) · refund.* (281)
  Window       2026-09-28T00:00:00Z → now
  Quota        4,182 events (8.4% of remaining)
```

## What a replay looks like to the receiver

A replayed delivery is marked, so a handler can treat it differently if it
needs to:

```http
Voltstream-Replay: true
Voltstream-Event-Id: evt_9Kd2mQ
Voltstream-Original-Timestamp: 1790582062
```

The **event ID does not change**. An idempotent handler will therefore skip a
replayed event it has already processed — which is usually what you want, and
occasionally not.

:::caution Replaying will not redo work an idempotent handler already did
If you are replaying because a handler had a bug, the handler will see a known
event ID and skip it. Clear the relevant rows from your processed-events table
first, or the replay is a no-op.
:::

## Ordering

Replays are delivered in original publish order, oldest first, at a rate that
respects the endpoint's health. A large replay does not burst — it paces itself
and will back off if the endpoint starts failing.

Concurrent replays are limited by plan. Queued replays start as earlier ones
finish.

## Cancelling

```bash
voltstream replays list
voltstream replays cancel rpl_7Qm2xK
```

Cancelling stops further deliveries. Events already delivered stay delivered —
there is no way to un-send.

## What cannot be replayed

- Events older than your plan's payload retention. The delivery log still shows
  they existed; the payload is gone.
- Events to a deleted endpoint. Recreate it — note that a new endpoint gets a
  new signing secret.
- Events that were never accepted. A publish rejected with `4xx` was never an
  event.
