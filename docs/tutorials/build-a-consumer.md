---
id: build-a-consumer
title: "Tutorial: build a production consumer"
sidebar_label: Build a consumer
sidebar_position: 1
description: A webhook receiver that verifies signatures, survives duplicates and does not lose work — start to finish.
---

# Build a production consumer

The quickstart receiver is fine for a demo and wrong for production: it verifies
the signature but has no durability, no idempotency and no way to recover from a
crash mid-handler.

This tutorial builds one you could actually deploy. About 30 minutes.

**You will need** Node 18+, a Postgres database, and a test API key.

## What we are building

```text
Voltstream ──▶ POST /webhooks ──▶ verify ──▶ INSERT inbox ──▶ 204
                                                  │
                                            worker polls
                                                  │
                                                  ▼
                                            apply + mark done
```

The important move is that the HTTP handler **does not do the work**. It
durably records the event and acknowledges. A separate worker applies it. That
separation is what makes the thing survive a crash.

## 1. The inbox table

```sql title="migrations/001_inbox.sql"
CREATE TABLE inbox (
  event_id      TEXT PRIMARY KEY,
  event_type    TEXT        NOT NULL,
  payload       JSONB       NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  attempts      INT         NOT NULL DEFAULT 0,
  last_error    TEXT
);

-- The worker's query: unprocessed, oldest first.
CREATE INDEX inbox_pending ON inbox (received_at) WHERE processed_at IS NULL;
```

`event_id` as the primary key is what makes duplicates free — a second delivery
of the same event collides and is ignored.

## 2. The handler

```js title="src/webhook.js"
import express from 'express';
import { verify } from '@voltstream/sdk';
import { db } from './db.js';

export const app = express();

app.post(
  '/webhooks',
  // Raw body: a parsed one will not match the signature.
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    let event;
    try {
      event = verify(
        req.body,
        req.headers['voltstream-signature'],
        process.env.VOLTSTREAM_WEBHOOK_SECRET,
      );
    } catch {
      // 400 is permanent — retrying a bad signature will not fix it.
      return res.status(400).send('invalid signature');
    }

    try {
      await db`
        INSERT INTO inbox (event_id, event_type, payload)
        VALUES (${event.id}, ${event.type}, ${db.json(event.data)})
        ON CONFLICT (event_id) DO NOTHING
      `;
    } catch (err) {
      // 500 so Voltstream retries — we have not durably accepted it.
      console.error('inbox insert failed', err);
      return res.status(500).send('could not accept');
    }

    res.status(204).end();
  },
);
```

Two things worth being deliberate about:

- **`400` on a bad signature, `500` on a database failure.** The first is
  permanent and retrying is pointless. The second is transient and we *want*
  the retry.
- **Acknowledge only after the insert commits.** Returning `204` before the row
  is durable means a crash loses the event with Voltstream believing it landed.

## 3. The worker

```js title="src/worker.js"
import { db } from './db.js';
import { handlers } from './handlers.js';

const BATCH = 50;

async function tick() {
  // FOR UPDATE SKIP LOCKED lets several workers run without stepping on
  // each other — each one takes rows the others have not locked.
  const rows = await db`
    SELECT event_id, event_type, payload, attempts
    FROM inbox
    WHERE processed_at IS NULL AND attempts < 10
    ORDER BY received_at
    LIMIT ${BATCH}
    FOR UPDATE SKIP LOCKED
  `;

  for (const row of rows) {
    const handle = handlers[row.event_type];

    if (!handle) {
      // An unknown type is not a failure — mark it done so it stops being
      // picked up, and keep the row for audit.
      await db`UPDATE inbox SET processed_at = now() WHERE event_id = ${row.event_id}`;
      continue;
    }

    try {
      await db.begin(async (tx) => {
        await handle(tx, row.payload);
        await tx`UPDATE inbox SET processed_at = now() WHERE event_id = ${row.event_id}`;
      });
    } catch (err) {
      await db`
        UPDATE inbox
        SET attempts = attempts + 1, last_error = ${String(err).slice(0, 500)}
        WHERE event_id = ${row.event_id}
      `;
      console.error(`handler failed for ${row.event_id}`, err);
    }
  }
}

setInterval(() => tick().catch(console.error), 1000);
```

The work and the `processed_at` update share one transaction. If the handler
throws, both roll back and the row is retried. If the process dies mid-handler,
the transaction never commits and the row is picked up again.

## 4. A handler

```js title="src/handlers.js"
export const handlers = {
  'order.created': async (tx, data) => {
    await tx`
      INSERT INTO orders (id, amount_cents, currency, status)
      VALUES (${data.order_id}, ${data.amount_cents}, ${data.currency}, 'created')
      ON CONFLICT (id) DO NOTHING
    `;
  },

  'order.cancelled': async (tx, data) => {
    await tx`
      UPDATE orders SET status = 'cancelled' WHERE id = ${data.order_id}
    `;
  },
};
```

Handlers receive the transaction, never the global connection. Using `db`
instead of `tx` here would silently break atomicity — the work would commit
even when the row is rolled back.

## 5. Try it

```bash
npm run dev
npx @voltstream/relay --forward http://localhost:4000/webhooks
```

```bash
voltstream events publish \
  --stream orders \
  --type order.created \
  --data '{"order_id":"ord_88213","amount_cents":4999,"currency":"usd"}'
```

Then prove the properties hold:

```bash
# Duplicate — should insert once, process once.
voltstream events replay evt_… && voltstream events replay evt_…

# Crash mid-handler — stop the worker, restart, the row is still picked up.
```

```sql
SELECT event_id, processed_at, attempts, last_error FROM inbox ORDER BY received_at DESC LIMIT 5;
```

## 6. Before you deploy

- **Poison messages.** `attempts < 10` stops a permanently failing row from
  spinning forever. Alert on rows that reach it — they are bugs, not blips.
- **Prune.** Delete processed rows older than your retention window.
- **Monitor lag.** `now() - min(received_at) WHERE processed_at IS NULL` is the
  number to alert on. Rising lag means the worker is behind.
- **Scale workers, not the handler.** `SKIP LOCKED` means you can run several
  replicas with no coordination.

## What to read next

- [Idempotency](../guides/idempotency.md) — the patterns behind the inbox table.
- [Replaying events](../guides/replaying-events.md) — and why a replay may be a no-op here.
