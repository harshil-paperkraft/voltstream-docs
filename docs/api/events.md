---
id: events
title: Events
sidebar_position: 3
description: Publish, batch, list, retrieve and replay events.
---

# Events

## The event object

```json
{
  "id": "evt_9Kd2mQ",
  "stream_id": "str_2n4Kx9Lm",
  "type": "order.created",
  "data": {
    "order_id": "ord_88213",
    "amount_cents": 4999,
    "currency": "usd"
  },
  "idempotency_key": "order-88213-created",
  "delivery_count": 14,
  "pending_count": 0,
  "published_at": "2026-09-29T09:14:22Z"
}
```

Events are immutable. There is no update endpoint — publish a correction as a
new event.

## Publish an event

```http
POST /v1/events
```

| Parameter | Required | Notes |
| --- | --- | --- |
| `stream_id` | yes | ID or stream name |
| `type` | yes | Dot-separated, `a–z0–9._`, max 128 chars |
| `data` | yes | Any JSON object. Max 256 KB serialised |
| `occurred_at` | no | When it happened, if not now. Cannot be in the future |

Send `Voltstream-Idempotency-Key` on every publish. Keys are remembered for 24
hours.

```bash
curl -X POST https://api.voltstream.io/v1/events \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -H "Voltstream-Idempotency-Key: order-88213-created" \
  -d '{
    "stream_id": "str_2n4Kx9Lm",
    "type": "order.created",
    "data": {"order_id": "ord_88213", "amount_cents": 4999, "currency": "usd"}
  }'
```

```js title="Node"
const event = await vs.events.publish({
  streamId: 'str_2n4Kx9Lm',
  type: 'order.created',
  data: { orderId: 'ord_88213', amountCents: 4999, currency: 'usd' },
  idempotencyKey: 'order-88213-created',
});
```

```python title="Python"
event = vs.events.publish(
    stream_id="str_2n4Kx9Lm",
    type="order.created",
    data={"order_id": "ord_88213", "amount_cents": 4999, "currency": "usd"},
    idempotency_key="order-88213-created",
)
```

```go title="Go"
event, err := client.Events.Publish(ctx, &voltstream.PublishParams{
    StreamID:       "str_2n4Kx9Lm",
    Type:           "order.created",
    Data:           map[string]any{"order_id": "ord_88213", "amount_cents": 4999},
    IdempotencyKey: "order-88213-created",
})
```

Returns `202 Accepted` — the event is durably stored and queued. Delivery has
not necessarily happened yet. Requires the `publish` scope.

## Publish a batch

```http
POST /v1/events/batch
```

Up to 500 events in one request. Counts as one request against the rate limit;
each event still counts against quota.

```bash
curl -X POST https://api.voltstream.io/v1/events/batch \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": "str_2n4Kx9Lm",
    "events": [
      {"type": "order.created", "data": {"order_id": "ord_1"}, "idempotency_key": "ord-1-created"},
      {"type": "order.created", "data": {"order_id": "ord_2"}, "idempotency_key": "ord-2-created"}
    ]
  }'
```

A batch is **not atomic**. Each event succeeds or fails on its own, and the
response reports per-event status:

```json
{
  "accepted": 1,
  "rejected": 1,
  "results": [
    {"index": 0, "id": "evt_9Kd2mQ", "status": "accepted"},
    {"index": 1, "status": "rejected", "error": {"code": "payload_too_large"}}
  ]
}
```

Always check `rejected`. A `200` on the batch does not mean every event landed.

## List events

```http
GET /v1/events
```

| Parameter | Notes |
| --- | --- |
| `stream_id` | Filter to one stream |
| `type` | Exact match or wildcard — `order.*` |
| `since`, `until` | RFC 3339 |
| `status` | `delivered`, `pending`, `undelivered` |
| `limit`, `cursor` | Pagination |

```bash
curl "https://api.voltstream.io/v1/events?stream_id=str_2n4Kx9Lm&type=order.*&status=undelivered" \
  -H "Authorization: Bearer $VOLTSTREAM_KEY"
```

## Retrieve an event

```http
GET /v1/events/{id}
```

Add `?expand=deliveries` for every attempt against every endpoint, including
response codes and bodies (first 2 KB).

## Replay an event

```http
POST /v1/events/{id}/replay
```

| Parameter | Notes |
| --- | --- |
| `endpoint_id` | Replay to one endpoint. Omit for all that originally matched |

Requires the `replay` scope. Replays count against quota. See
[Replaying events](../guides/replaying-events.md).

## Event types you receive

Voltstream publishes its own events to any stream you subscribe to them on.

| Type | Fires when |
| --- | --- |
| `endpoint.disabled` | An endpoint is auto-disabled after repeated failure |
| `endpoint.enabled` | An endpoint is re-enabled |
| `delivery.failed` | A single attempt fails |
| `delivery.exhausted` | All 8 attempts failed; event marked undelivered |
| `replay.completed` | A replay finished |
| `quota.threshold` | 80% or 100% of monthly quota reached |
