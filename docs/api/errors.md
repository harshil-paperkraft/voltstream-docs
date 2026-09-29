---
id: errors
title: Error codes
sidebar_position: 5
description: Every error code, what causes it, and what to do about it.
---

# Error codes

## Error shape

Every error returns the same body. Read `error.code`, not the message — messages
are written for humans and may be reworded.

```json
{
  "error": {
    "code": "invalid_filter",
    "message": "Operator 'between' is not supported on data.amount_cents.",
    "param": "filter.data.amount_cents",
    "docs_url": "https://docs.voltstream.io/docs/guides/event-filtering",
    "request_id": "req_8Km2xQ4n"
  }
}
```

## Status codes

| Status | Meaning | Retry? |
| --- | --- | --- |
| `400` | Malformed request | No — fix the request |
| `401` | Authentication failed | No |
| `403` | Authenticated, not permitted | No |
| `404` | No such object, or not in this environment | No |
| `409` | Conflict with current state | Depends — see the code |
| `413` | Payload too large | No |
| `422` | Well-formed but semantically invalid | No |
| `429` | Rate limited or out of quota | Yes, after `Retry-After` |
| `5xx` | Our fault | Yes, with backoff |

## Authentication — 401

| Code | Cause | Fix |
| --- | --- | --- |
| `missing_api_key` | No `Authorization` header | Send `Authorization: Bearer vs_…` |
| `invalid_api_key` | Key does not exist or was revoked | Check for truncation, then rotate |
| `expired_api_key` | Retired key past its grace period | Deploy the replacement |
| `environment_mismatch` | Test key on live data, or the reverse | Match the key prefix to the environment |

## Authorisation — 403

| Code | Cause | Fix |
| --- | --- | --- |
| `insufficient_scope` | Key lacks the scope | `error.message` names the required scope |
| `account_suspended` | Billing or policy | Contact support |
| `region_mismatch` | Object lives in another region | Use that region's environment |

## Validation — 400 / 422

| Code | Cause |
| --- | --- |
| `invalid_request` | Malformed JSON or a missing required parameter |
| `invalid_event_type` | Not matching `a–z0–9._`, or over 128 chars |
| `invalid_url` | Not HTTPS, or resolves to a private or loopback address |
| `invalid_filter` | Unknown operator, or nesting deeper than three levels |
| `invalid_cursor` | Cursor malformed or expired. Restart pagination |
| `occurred_at_in_future` | `occurred_at` is later than now |

## Conflict — 409

| Code | Cause | Fix |
| --- | --- | --- |
| `stream_name_taken` | Name exists in this environment | Pick another |
| `idempotency_conflict` | Same key, different payload | Derive the key from more of the event |
| `idempotency_in_progress` | Identical request still running | Retry after a moment |
| `stream_has_endpoints` | Deleting a stream with endpoints | Delete them, or pass `?force=true` |
| `endpoint_disabled` | Action needs an active endpoint | Enable it first |

## Size — 413

| Code | Limit |
| --- | --- |
| `payload_too_large` | 256 KB per event, serialised |
| `batch_too_large` | 500 events, or 5 MB total |
| `metadata_too_large` | 16 pairs, 500 chars per value |

Storing large objects in an event payload is usually the wrong shape. Send an
identifier and let the receiver fetch it through an authenticated API — the
payload stays small and access stays checkable.

## Limits — 429

| Code | Meaning | `Retry-After`? |
| --- | --- | --- |
| `rate_limited` | Too many requests per second | Yes — honour it |
| `quota_exceeded` | Monthly event quota reached | No — waiting will not help |
| `replay_limit_reached` | Too many concurrent replays | Yes |

Distinguish `rate_limited` from `quota_exceeded` by the code, never the status.
Retrying a `quota_exceeded` forever is a common and expensive mistake.

## Server — 5xx

| Code | Meaning |
| --- | --- |
| `internal_error` | Unexpected. Retry with backoff |
| `service_unavailable` | Planned or unplanned unavailability. Honour `Retry-After` |
| `region_degraded` | Your region is degraded. Publishes may be slow but are accepted |

Retry `5xx` with exponential backoff and jitter, keeping the **same idempotency
key** so a retry after a lost response does not create a duplicate.

## Getting help

Include the `request_id` — support cannot investigate without it. If several
requests failed, the first one is more useful than the latest.

Check [status.voltstream.io](https://status.voltstream.io) before opening a
ticket for `5xx`.
