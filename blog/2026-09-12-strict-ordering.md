---
slug: strict-ordering
title: Opt-in strict ordering per endpoint
authors: [dev]
tags: [delivery]
---

Delivery order has always been best-effort: a failing delivery holds its place
for five minutes, then later events overtake it. That keeps one broken endpoint
from stalling its queue forever, and it is the right default.

It is also wrong for a small number of receivers — state machines that genuinely
cannot apply `order.cancelled` before `order.created`.

<!-- truncate -->

## Setting it

```bash
curl -X PATCH https://api.voltstream.io/v1/endpoints/ep_4Lm8x \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ordering": "strict"}'
```

With `strict`, a failing delivery blocks its queue until it succeeds or the
endpoint is disabled. Nothing overtakes it.

## The trade-off is real

Head-of-line blocking is the whole point, and it is also the cost. One endpoint
returning `500` on one poisonous event stops everything behind it. That endpoint
will hit the 20-consecutive-failure threshold and be disabled, at which point
the queue is frozen until someone intervenes.

Before switching, ask whether the receiver can be made order-independent
instead. Applying a version number or a state check in the handler is almost
always cheaper than blocking a queue, and it survives replays — which arrive in
original order but may be interleaved with live traffic.

`relaxed` stays the default and we are not changing that.
