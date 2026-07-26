# ManaBox CSV Manager

ManaBox CSV Manager is a local-first MVP for importing, reviewing, editing, splitting, queueing, and exporting ManaBox CSV collections.

The primary workflow is deterministic: import a ManaBox CSV, add listing target
prices, preview Cardmarket-safe batches, and publish a durable local queue.
Steward AI remains an optional planning interface and is not required for queue
preparation.

The app stores collection data in your browser. It does not scrape Cardmarket, fetch live prices, require user accounts, or send full card records to a remote database.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Optional: add Steward AI config

Create a private `.env` file in the project root:

```text
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

You can also copy `.env.example` and fill in the values.

Skip this step when only using the deterministic Cardmarket queue. Never commit
`.env`. The browser does not read these values; they are only used by the local
Node server.

### 3. Run the app

```bash
npm run dev
```

This starts:

- the Vite client
- the local Steward AI API server

Open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

### 4. Import a ManaBox CSV

Export a collection from ManaBox, then drop the `.csv` file into the import box.

Each import creates a separate local collection. The first import becomes the main collection by default.

### 5. Prepare a Cardmarket queue

Add a positive `Target price` to each record you want to list, then select
`Prepare Cardmarket queue`.

The app previews validation issues and deterministic set-and-rarity batches.
Published jobs are written under the monorepo `.runtime/jobs` directory by
default.

### 6. Optional: use Steward AI

Use the bottom Steward AI dock to open the sidebar. The main MVP use case is:

```text
Break this collection down by set name and rarity
```

Steward AI previews the collections it plans to create. Nothing changes until you approve the plan.

## Common Commands

```bash
npm run dev
npm run build
npm run lint
npm test
```

## MVP Scope

Included:

- ManaBox CSV import
- local browser storage
- multiple collections
- collection copy/delete
- table filtering, editing, and removal
- active collection CSV export
- deterministic Cardmarket queue preview and publishing
- versioned queue manifests and file fingerprints
- explicit blocking of missing listing prices and unsupported finishes
- Steward AI planning for collection splitting
- approval before changes are applied
- audit trail and undo for Steward-created collections
- download of collections created by Steward AI

Not included yet:

- Cardmarket price checks
- live market data
- scraping
- Cardmarket account automation
- cloud sync
- user authentication

## Documentation

See [docs/README.md](docs/README.md) for the detailed MVP guide, Steward AI notes, and future feature proposals.
