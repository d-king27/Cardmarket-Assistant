# Steward AI Guide

## Purpose

Steward AI is an operation-planning interface for collection management. It is not a general chatbot.

The primary MVP workflow is splitting large collections into smaller collections that are compatible with Cardmarket bulk upload workflows.

Example request:

```text
Break this collection down by set name and rarity
```

## How It Works

1. The user opens Steward AI.
2. The user chooses a common operation or enters a custom request.
3. The browser sends the request and a compact collection summary to the local Node server.
4. The local server asks Anthropic for a structured plan.
5. The browser validates the plan.
6. The browser previews the local changes.
7. The user approves or rejects the plan.
8. Approved plans are applied locally.
9. An audit entry is recorded.

If the AI provider is unavailable for the main split/batch workflow, the server can use a deterministic local fallback plan.

## Environment

Create a private `.env` file in the project root:

```text
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

Prompt caching is enabled in the Steward server configuration. The current server-side config lives in:

```text
server/stewardConfig.ts
```

The browser never reads the Anthropic key.

## Privacy Model

Sent to Anthropic:

- user request
- active collection name
- record and quantity counts
- selected count and scope
- current filters
- available sets, rarities, conditions, languages, finishes, and currencies
- price summary statistics
- validation issue counts
- supported operation schema

Not sent by default:

- full card rows
- notes for every card
- complete CSV contents
- local IndexedDB data

## Approval And Undo

Steward AI never mutates inventory directly.

The workflow is:

1. Request a plan.
2. Validate the structured response.
3. Calculate the local preview.
4. Review affected counts and collections to create.
5. Apply or reject.
6. Record an audit entry.
7. Undo the latest applied Steward action when needed.

Undo is local and never calls Anthropic.

## Current Supported Workflow

The only operation currently advertised to the model and accepted for execution
is `split_collection`. It supports:

- split by set name
- split by set code
- split by rarity
- split by finish
- split by language
- split by condition
- create batches with a maximum row count
- copy records into new collections while preserving the source collection

Other operation models remain in the application for future work, but the
Steward does not advertise or execute them yet. An unsupported operation is
rejected before inventory can be changed.

## Cardmarket CSV Naming

Steward-created Cardmarket collections use this filename convention:

```text
001__DFT__rare.csv
002__DFT__uncommon.csv
003__RVR__uncommon.csv
```

The format is:

```text
number__set-code__rarity.csv
```

Rules:

- `number` is a three-digit sequence.
- `set-code` is uppercase.
- `rarity` is lowercase.
- separators are double underscores.
- duplicate generated collections keep the same convention by advancing the sequence number.

## Current Boundaries

Requests requiring external market data are unsupported in this phase, including:

- current Cardmarket prices
- recent sales
- price spikes
- market value lookups
- scraping

Those belong to a later Pricing Analyst phase.
