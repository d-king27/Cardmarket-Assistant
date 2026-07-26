# Cardmarket Assistant

Monorepo for a local, review-first Cardmarket listing workflow:

```text
raw CSV -> data tool -> local queue -> Playwright companion -> browser extension
```

## Projects

- `cardmarket-data-tool`: imports inventory, validates pricing, and publishes
  deterministic queue jobs.
- `cardmarket-playwright-tool`: discovers and stages prepared batches in a
  persistent browser session.
- `cardmarket-bulk-import-browser-tool`: integrates with Cardmarket's bulk
  listing page.
- `packages/cardmarket-contracts`: owns versioned queue and browser-message
  schemas shared by all three applications.

The first workflow does not require AI. Steward AI is optional and currently
limited to proposing `split_collection` operations; queue preparation remains
deterministic.

## Setup

Install the shared package first, followed by each application:

```powershell
cd packages/cardmarket-contracts
npm install

cd ../../cardmarket-data-tool
npm install

cd ../cardmarket-playwright-tool
npm install

cd ../cardmarket-bulk-import-browser-tool
corepack yarn install
```

See [Shared Contracts](docs/shared-contracts.md) and the
[Cardmarket Queue](cardmarket-data-tool/docs/cardmarket-queue.md) for the current
integration boundary and validation commands.

After publishing a queue job in the data tool:

```powershell
cd cardmarket-playwright-tool
npm run jobs
npm run plan
npm run stage
npm run queue
```
