---
id: endpoints
title: Endpoints
sidebar_position: 4
description: Create, configure, test and rotate subscriber endpoints.
---

# Endpoints

An endpoint is a URL that receives events from a stream, with its own filter,
signing secret and health state.

## The endpoint object

```json
{
  "id": "ep_4Lm8x",
  "stream_id": "str_2n4Kx9Lm",
  "url": "https://partner.example.com/voltstream",
  "event_types": ["order.*"],
  "filter": {"data.amount_cents": {"gte": 1000}},
  "status": "active",
  "ordering": "relaxed",
  "description": "Northwind — live",
  "metadata": {"customer_id": "cus_912"},
  "consecutive_failures": 0,
  "last_delivery_at": "2026-09-29T09:14:24Z",
  "created_at": "2026-04-02T11:09:02Z"
}
```

| Field | Notes |
| --- | --- |
| `url` | Must be HTTPS. Private and loopback ranges are rejected |
| `status` | `active`, `disabled`, `paused` |
| `ordering` | `relaxed` (default) or `strict` |
| `metadata` | Up to 16 key/value pairs, echoed on related events |

## Create an endpoint

```http
POST /v1/endpoints
```

| Parameter | Required | Notes |
| --- | --- | --- |
| `stream_id` | yes | |
| `url` | yes | HTTPS only |
| `event_types` | no | Defaults to `["**"]` |
| `filter` | no | See [Event filtering](../guides/event-filtering.md) |
| `ordering` | no | `relaxed` or `strict` |
| `description`, `metadata` | no | |

```bash
curl -X POST https://api.voltstream.io/v1/endpoints \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": "str_2n4Kx9Lm",
    "url": "https://partner.example.com/voltstream",
    "event_types": ["order.*"],
    "description": "Northwind — live"
  }'
```

:::caution The signing secret is shown once
The response contains `signing_secret` starting `whsec_`. It is never returned
again. Store it before you close the connection; if it is lost, rotate.
:::

## Update an endpoint

```http
PATCH /v1/endpoints/{id}
```

`url`, `event_types`, `filter`, `ordering`, `description` and `metadata` can all
be changed. Changes apply to events published after the update — in-flight
retries keep the configuration they started with.

## Pause and resume

```http
POST /v1/endpoints/{id}/pause
POST /v1/endpoints/{id}/resume
```

Pausing stops delivery attempts without disabling the endpoint. Matching events
still accumulate and remain replayable. Use it during a planned deploy on the
receiver's side.

## Enable a disabled endpoint

```http
POST /v1/endpoints/{id}/enable
```

Resets the failure counter. Events that arrived while it was disabled are not
sent automatically — [replay](../guides/replaying-events.md) the window.

## Rotate the signing secret

```http
POST /v1/endpoints/{id}/rotate-secret
```

| Parameter | Notes |
| --- | --- |
| `grace_period_hours` | 0–168, default 24 |

Both secrets verify during the grace period, so the receiver can deploy without
dropping deliveries. During rotation, deliveries carry two signatures:

```http
Voltstream-Signature: t=1790668462,v1=5257a869…,v1=9b2f01ae…
```

Verify against either — a match on one is a pass. Most SDKs handle this.

## Send a test event

```http
POST /v1/endpoints/{id}/test
```

Sends a synthetic `voltstream.test` event and returns the receiver's full
response, including status, headers and the first 2 KB of the body.

```bash
voltstream endpoints test ep_4Lm8x
```

```text title="Output"
✔ 204 No Content  ·  142 ms
  Signature verified by receiver: unknown (no body returned)
```

Test events do not count against quota and do not affect endpoint health.

## Delete an endpoint

```http
DELETE /v1/endpoints/{id}
```

Deleting is immediate and drops pending retries. The delivery history remains
queryable for your retention window. A recreated endpoint gets a **new** signing
secret.
