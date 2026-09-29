---
slug: batch-publish
title: Batch publish, and why it is not atomic
authors: [priya]
tags: [api, rate-limits]
---

`POST /v1/events/batch` takes up to 500 events in one request. It counts as a
single request against your rate limit, which is the point: the nightly job that
publishes two hundred thousand events at 02:00 no longer burst-limits itself.

<!-- truncate -->

```bash
curl -X POST https://api.voltstream.io/v1/events/batch \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"stream_id": "str_2n4Kx9Lm", "events": [ ... ]}'
```

Each event still counts against quota. Batching changes how many *requests* you
make, not how many events you send.

## It is deliberately not atomic

A batch is not a transaction. Each event is accepted or rejected on its own, and
the response says which:

```json
{
  "accepted": 499,
  "rejected": 1,
  "results": [
    {"index": 0, "id": "evt_9Kd2mQ", "status": "accepted"},
    {"index": 1, "status": "rejected", "error": {"code": "payload_too_large"}}
  ]
}
```

We considered all-or-nothing and rejected it. One oversized payload in a batch
of five hundred would discard 499 good events, and the retry would almost
certainly contain the same bad one.

**So check `rejected`.** A `200` on the batch does not mean every event landed —
this is the part that bites people, and it bites them quietly, because the
status code looks fine.

Per-event idempotency keys work exactly as they do on single publishes, so
retrying a partially-failed batch is safe.
