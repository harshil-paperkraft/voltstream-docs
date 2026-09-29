---
id: overview
title: Overview
sidebar_position: 1
description: Base URL, conventions, pagination and versioning.
---

# API overview

```text
https://api.voltstream.io/v1
```

REST over HTTPS. JSON in, JSON out. HTTP/2 supported; TLS 1.2 minimum.

## Conventions

| | |
| --- | --- |
| Auth | `Authorization: Bearer vs_live_…` |
| Content type | `application/json` on every request with a body |
| Timestamps | RFC 3339, always UTC — `2026-09-29T09:14:22Z` |
| IDs | Prefixed and opaque — `evt_9Kd2mQ`, `str_2n4Kx9Lm`, `ep_4Lm8x` |
| Money | Integer minor units plus a currency code. Never floats |

Do not parse IDs. The prefix is stable; the rest is not, and length may change.

## Pagination

Cursor-based. Offsets are not supported — they skip and duplicate rows when the
underlying set changes between pages.

```bash
curl "https://api.voltstream.io/v1/events?limit=50" \
  -H "Authorization: Bearer $VOLTSTREAM_KEY"
```

```json
{
  "data": [ /* … */ ],
  "has_more": true,
  "next_cursor": "ZXZ0Xzlq"
}
```

```bash
curl "https://api.voltstream.io/v1/events?limit=50&cursor=ZXZ0Xzlq" \
  -H "Authorization: Bearer $VOLTSTREAM_KEY"
```

`limit` defaults to 20 and caps at 100. Stop when `has_more` is `false` — do not
stop on a short page, which is a valid intermediate state.

## Expanding related objects

```bash
curl "https://api.voltstream.io/v1/deliveries/dlv_3Nq7?expand=event,endpoint" \
  -H "Authorization: Bearer $VOLTSTREAM_KEY"
```

`expand` accepts a comma-separated list, one level deep only.

## Versioning

The version is in the path. `v1` is current and stable.

Additive changes — a new field, a new event type, a new optional parameter —
ship without a version bump. Write clients that ignore unknown fields.

Breaking changes get a new path. `v1` will be supported for at least 24 months
after `v2` is announced, and the deprecation date appears in a `Sunset` header
on every response long before then.

## Request IDs

Every response carries one:

```http
Voltstream-Request-Id: req_8Km2xQ4n
```

Log it. Support cannot investigate a failed request without it.

## Endpoints

| Resource | Purpose |
| --- | --- |
| [Streams](./streams.md) | Create and manage channels |
| [Events](./events.md) | Publish, list and replay |
| [Endpoints](./endpoints.md) | Subscriber URLs, filters and secrets |
| [Errors](./errors.md) | Every code, what it means, what to do |
