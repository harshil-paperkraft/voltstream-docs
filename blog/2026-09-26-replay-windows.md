---
slug: replay-windows
title: Replay windows, and per-endpoint replay
authors: [priya]
tags: [replay, api]
---

Replays used to be all-or-nothing: one event, to every endpoint that matched it.
That was fine for a single stuck delivery and useless for the case people
actually had — one partner was down for six hours and needs to catch up, while
everyone else is fine.

<!-- truncate -->

## What is new

`POST /v1/events/{id}/replay` now accepts an `endpoint_id`, and the CLI takes a
window:

```bash
voltstream events replay \
  --endpoint ep_4Lm8x \
  --since 2026-09-28T00:00:00Z \
  --until 2026-09-28T06:00:00Z \
  --types "order.*"
```

Replays are paced against endpoint health rather than fired as fast as the queue
drains, so catching up on four thousand events no longer knocks over the server
that just came back.

`--dry-run` reports the count and quota cost before anything is sent. Use it.
A mis-scoped window is the expensive mistake here, and it is silent.

## One thing to watch

If you are replaying because a handler had a bug, an idempotent receiver will
skip the events — the event ID has not changed, so it looks like one it has
already processed. Clear the relevant rows from your processed-events table
first, or the replay is a no-op.

See [Replaying events](/docs/guides/replaying-events) for the full behaviour.
