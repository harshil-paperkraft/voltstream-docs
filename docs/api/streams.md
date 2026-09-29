---
id: streams
title: Streams
sidebar_position: 2
description: Create, list, update and delete streams.
---

# Streams

A stream is a named channel within an environment. Endpoints subscribe to a
stream; events are published to one.

## The stream object

```json
{
  "id": "str_2n4Kx9Lm",
  "name": "orders",
  "description": "Order lifecycle events",
  "environment": "live",
  "endpoint_count": 14,
  "events_30d": 182043,
  "created_at": "2026-04-02T11:03:51Z",
  "updated_at": "2026-09-12T08:22:10Z"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Opaque, prefixed `str_` |
| `name` | string | Unique per environment. Lowercase, `a–z0–9-_`, 2–64 chars |
| `description` | string \| null | Up to 500 chars |
| `environment` | enum | `test` or `live`. Set by the key used to create it |
| `endpoint_count` | integer | Endpoints currently subscribed |
| `events_30d` | integer | Rolling 30-day publish count |

## Create a stream

```http
POST /v1/streams
```

| Parameter | Required | Notes |
| --- | --- | --- |
| `name` | yes | Unique per environment |
| `description` | no | |

```bash
curl -X POST https://api.voltstream.io/v1/streams \
  -H "Authorization: Bearer $VOLTSTREAM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "orders", "description": "Order lifecycle events"}'
```

Requires the `manage` scope. Returns `409 stream_name_taken` if the name exists
in that environment.

## Retrieve a stream

```http
GET /v1/streams/{id}
```

Accepts either the ID or the name:

```bash
curl https://api.voltstream.io/v1/streams/orders \
  -H "Authorization: Bearer $VOLTSTREAM_KEY"
```

## List streams

```http
GET /v1/streams
```

| Parameter | Notes |
| --- | --- |
| `limit` | 1–100, default 20 |
| `cursor` | From `next_cursor` |

## Update a stream

```http
PATCH /v1/streams/{id}
```

Only `description` can be changed. **A stream cannot be renamed** — the name
appears in endpoint configuration and historical delivery records, and changing
it would silently re-point subscribers. Create a new stream and migrate.

## Delete a stream

```http
DELETE /v1/streams/{id}
```

```bash
curl -X DELETE https://api.voltstream.io/v1/streams/str_2n4Kx9Lm \
  -H "Authorization: Bearer $VOLTSTREAM_KEY"
```

:::danger
Deleting a stream deletes its endpoints and makes its events unreplayable. It
cannot be undone. A stream with endpoints returns `409 stream_has_endpoints`
unless you pass `?force=true`.
:::
