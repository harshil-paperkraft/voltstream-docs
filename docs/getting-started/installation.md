---
id: installation
title: Installation
sidebar_position: 2
description: Official SDKs for Node, Python, Go and Ruby, plus the CLI.
---

# Installation

Every SDK wraps the same REST API. Anything an SDK can do, `curl` can do —
the SDKs exist for signature verification, typed payloads and retry-aware
publishing.

## Node

```bash
npm install @voltstream/sdk
```

```js
import { Voltstream } from '@voltstream/sdk';

const vs = new Voltstream({ apiKey: process.env.VOLTSTREAM_KEY });
```

Requires Node 18 or later. Ships its own types; no `@types` package needed.

## Python

```bash
pip install voltstream
```

```python
from voltstream import Voltstream

vs = Voltstream(api_key=os.environ["VOLTSTREAM_KEY"])
```

Requires Python 3.9 or later. An async client is available as
`voltstream.AsyncVoltstream` with the same method names.

## Go

```bash
go get github.com/voltstream/voltstream-go
```

```go
import "github.com/voltstream/voltstream-go"

client := voltstream.New(os.Getenv("VOLTSTREAM_KEY"))
```

Requires Go 1.21 or later.

## Ruby

```bash
gem install voltstream
```

```ruby
require "voltstream"

vs = Voltstream::Client.new(api_key: ENV["VOLTSTREAM_KEY"])
```

Requires Ruby 3.0 or later.

## CLI

The CLI covers local development, replays and one-off inspection.

```bash
npm install -g @voltstream/cli
voltstream login
```

```bash title="Common commands"
voltstream relay --forward http://localhost:4000/webhooks
voltstream events list --stream orders --limit 20
voltstream events replay evt_9Kd2mQ
voltstream endpoints test ep_4Lm8x
```

## Configuration

Every SDK reads the same environment variables, so you rarely pass options in
code.

| Variable | Purpose |
| --- | --- |
| `VOLTSTREAM_KEY` | API key. Determines the environment from its prefix. |
| `VOLTSTREAM_WEBHOOK_SECRET` | Signing secret, for verifying inbound deliveries. |
| `VOLTSTREAM_BASE_URL` | Override the API host. Only needed for self-hosted. |
| `VOLTSTREAM_TIMEOUT_MS` | Per-request timeout. Default `10000`. |

## Verifying the install

```bash
voltstream whoami
```

```text title="Output"
Account      Northwind Retail
Environment  test
Key          vs_test_…8Kd2  (publish, read)
Region       eu-west
```

If this fails, see [Error codes](../api/errors.md) — the message names the
cause.
