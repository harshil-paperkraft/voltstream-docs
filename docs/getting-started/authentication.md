---
id: authentication
title: Authentication
sidebar_position: 3
description: API keys, scopes, the two environments, and how to rotate without downtime.
---

# Authentication

Every request carries an API key as a bearer token.

```bash
curl https://api.voltstream.io/v1/streams \
  -H "Authorization: Bearer $VOLTSTREAM_KEY"
```

There is no OAuth flow and no session. A key is the whole credential, which is
why scoping and rotation matter.

## Two environments

| Prefix | Environment | Notes |
| --- | --- | --- |
| `vs_test_` | Test | Isolated data. Deliveries go out for real, so relay URLs still work. |
| `vs_live_` | Live | Real customer endpoints. Treat as a production secret. |

A key cannot cross environments. Using a test key against live data returns
`401 environment_mismatch` rather than silently doing nothing — one of the more
common support tickets, and deliberately loud.

## Scopes

Grant the narrowest scope that works. Scopes are set when the key is created
and can be narrowed later, which takes effect immediately.

| Scope | Allows |
| --- | --- |
| `publish` | `POST /v1/events` only |
| `read` | Every `GET` endpoint |
| `manage` | Create and modify streams and endpoints |
| `replay` | Replay historical events |
| `admin` | Everything, including key management |

A publisher in your application should hold `publish` alone. If that key leaks,
the holder can send you events — they cannot read your delivery history,
re-point an endpoint at a server they control, or replay your customers' data.

:::danger
`admin` keys can create other keys. Never put one in an application. Use them
from a terminal or a secrets manager, and prefer short-lived keys.
:::

## Rotation

Rotation is two-phase, so there is no window where neither key works.

1. **Create the replacement.** `POST /v1/keys` with the same scopes.
2. **Deploy it.** Both keys are now valid.
3. **Retire the old one.** `POST /v1/keys/{id}/retire` starts a grace period —
   24 hours by default, configurable up to 7 days.
4. **Watch the grace counter.** The dashboard shows how many requests still use
   the retired key. When it reaches zero, you are done.
5. **Revoke.** `DELETE /v1/keys/{id}` takes effect immediately.

```bash title="Rotate with the CLI"
voltstream keys rotate vs_live_…8Kd2 --grace 48h
```

:::caution Revoking is not rotating
`DELETE` is immediate and has no grace period. If something is still using the
key, it starts failing at once. Retire first, then revoke.
:::

## Signing secrets are separate

The `whsec_` secret on an endpoint is not an API key. It verifies deliveries
*from* Voltstream and is never sent in a request *to* Voltstream. It is shown
once, at endpoint creation.

Lost it? `POST /v1/endpoints/{id}/rotate-secret` issues a new one and keeps the
old one valid for 24 hours, so you can deploy without dropping deliveries.

## What we log

Key **prefixes** appear in the audit log — `vs_live_…8Kd2` — never the full
value. We cannot show you a key after creation, and support cannot retrieve
one. If it is lost, rotate.
