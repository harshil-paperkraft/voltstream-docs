---
id: idempotency
title: Idempotency
sidebar_position: 2
description: Why duplicates happen, and how to make handling them cheap on both sides.
---

# Idempotency

Voltstream is at-least-once. Duplicates are not a bug to be fixed, they are a
property to be designed around — and the design is small.

## Why duplicates happen

A delivery succeeds on your side but the acknowledgement is lost on the way
back: a connection reset, a load balancer timeout, a pod evicted mid-response.
We never saw a `2xx`, so we retry. Your handler runs twice.

There is no way to eliminate this. Exactly-once delivery across a network
boundary is not achievable; exactly-once *processing* is, and that is what
idempotency buys you.

## On the publishing side

Send a `Voltstream-Idempotency-Key` with every publish. If we have seen that key
in the last 24 hours, we return the original event instead of creating a second
one.

```bash
curl -X POST https://api.voltstream.io/v1/events \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Voltstream-Idempotency-Key: order-88213-created" \
  -H "Content-Type: application/json" \
  -d '{"stream_id": "str_2n4Kx9Lm", "type": "order.created", "data": {"order_id": "ord_88213"}}'
```

The replayed response carries `Voltstream-Idempotent-Replay: true`.

Derive the key from the thing that happened, not from the attempt:

```js
// Good — same business event always produces the same key.
const key = `order-${order.id}-${order.status}`;

// Bad — a retry generates a new key and publishes a second event.
const key = crypto.randomUUID();
```

:::caution Same key, different payload
Reusing a key with a different body returns `409 idempotency_conflict`. This is
deliberate: it almost always means the key is derived from too little
information.
:::

## On the receiving side

Record the event ID before you do the work, in the same transaction as the
work.

```js
async function handle(event) {
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insertInto('processed_events')
      .values({ event_id: event.id, processed_at: new Date() })
      .onConflict((c) => c.column('event_id').doNothing())
      .executeTakeFirst();

    // Someone already handled this one.
    if (inserted.numInsertedRows === 0n) return;

    await applyOrderCreated(tx, event.data);
  });
}
```

The two properties that matter:

- **One transaction.** Marking the event processed and doing the work must
  commit together, or a crash between them loses the work while claiming it is
  done.
- **Insert first.** Checking for existence and then inserting is a race — two
  concurrent deliveries both see "not processed" and both do the work.

Keep the table pruned to your payload retention window; there is no value in
rows older than the oldest event that can still be replayed.

## What not to do

**Do not rely on payload equality.** Two genuinely distinct events can carry
identical bodies — a customer ordering the same item twice in a minute is not a
duplicate.

**Do not use the delivery attempt number.** `Voltstream-Delivery-Attempt: 1`
does not mean it is the first time your handler has seen it. A prior attempt may
have succeeded with a lost acknowledgement.

**Do not make the handler idempotent by making it slow.** Locking a row for the
duration of the work pushes you past the 10-second timeout, which causes a
retry — creating the duplicate you were guarding against.
