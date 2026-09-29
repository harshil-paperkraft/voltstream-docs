---
id: event-filtering
title: Event filtering
sidebar_position: 3
description: Send each endpoint only the events it cares about, using type patterns and payload predicates.
---

# Event filtering

An endpoint receives everything on its stream unless you narrow it. Two ways to
do that, and they compose.

## Type patterns

The common case. `event_types` accepts exact names and `*` wildcards.

```json
{
  "event_types": ["order.created", "order.cancelled"]
}
```

```json
{
  "event_types": ["order.*", "refund.*"]
}
```

`*` matches one segment. `order.*` matches `order.created` but not
`order.line_item.added`; use `order.**` for that.

| Pattern | Matches | Does not match |
| --- | --- | --- |
| `order.created` | `order.created` | `order.updated` |
| `order.*` | `order.created`, `order.paid` | `order.line_item.added` |
| `order.**` | `order.created`, `order.line_item.added` | `refund.created` |
| `**` | everything | — |

## Payload predicates

When the type is not enough, filter on the payload. Predicates run on our side,
so a filtered-out event never costs the receiver a request.

```json
{
  "event_types": ["order.created"],
  "filter": {
    "data.amount_cents": { "gte": 100000 },
    "data.currency": { "in": ["usd", "eur"] }
  }
}
```

Every key must match — the top level is an implicit AND.

### Operators

| Operator | Meaning | Example |
| --- | --- | --- |
| `eq`, `neq` | Equal, not equal | `{"data.status": {"eq": "paid"}}` |
| `gt`, `gte`, `lt`, `lte` | Numeric comparison | `{"data.amount_cents": {"gte": 5000}}` |
| `in`, `nin` | Membership | `{"data.region": {"in": ["eu", "uk"]}}` |
| `exists` | Key present | `{"data.coupon": {"exists": true}}` |
| `prefix` | String starts with | `{"data.sku": {"prefix": "BOOK-"}}` |

### Matching any of several conditions

```json
{
  "filter": {
    "or": [
      { "data.amount_cents": { "gte": 100000 } },
      { "data.flagged": { "eq": true } }
    ]
  }
}
```

`or` and `and` can nest to three levels. Deeper than that is usually a sign the
logic belongs in the receiver.

## Missing fields never match

A predicate on a key the payload does not contain evaluates to false — not to
an error, and not to true. So this endpoint receives nothing at all if
`data.region` is sometimes absent:

```json
{ "data.region": { "neq": "us" } }
```

If you mean "not US, including events with no region", say so:

```json
{
  "or": [
    { "data.region": { "neq": "us" } },
    { "data.region": { "exists": false } }
  ]
}
```

This is the single most common filtering mistake, and it is silent — the
endpoint simply goes quiet.

## Testing a filter before you save it

```bash
voltstream endpoints test-filter \
  --filter '{"data.amount_cents": {"gte": 100000}}' \
  --against evt_9Kd2mQ
```

```text title="Output"
✔ matches   evt_9Kd2mQ  order.created  amount_cents=250000
```

Or check against recent history to see how much traffic a filter would actually
let through:

```bash
voltstream endpoints test-filter --filter @filter.json --sample 500
```

```text title="Output"
  500 sampled · 23 matched (4.6%)
```

## Filtering is not authorisation

A filter controls what an endpoint is *sent*. It is not a security boundary —
if a payload contains something a subscriber must never see, remove it from the
payload. Do not rely on a predicate to hide it, because a filter change is one
API call away from exposing it.
