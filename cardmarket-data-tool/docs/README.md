# Documentation

This directory keeps the longer project notes out of the GitHub landing page while still making them easy to find.

## User And MVP Docs

- [MVP guide](mvp-guide.md): supported import/export behaviour, local data model, validation, and known limitations.
- [Cardmarket queue guide](cardmarket-queue.md): deterministic batching, blocking rules, local job storage, and generated manifests.
- [Steward AI guide](steward-ai.md): how the agent workflow works, what is sent to Anthropic, approval/undo behaviour, and current Phase 2 boundaries.

## Proposals

- [Data Steward and AI roadmap](proposals/data-steward-ai-roadmap.md): later agent architecture, shared data foundations, and the recommended order for data quality, pricing, deckbuilding, and reconciliation features.
- [Pricing Analyst proposal](proposals/pricing-analyst-proposal.txt): future plan for reviewing selected collection prices, identifying spikes/drops, and proposing price updates.

## Quick Reset For Manual Testing

To clear local browser data during manual testing:

1. Open browser dev tools.
2. Go to `Application`.
3. Under `Storage`, select `IndexedDB`.
4. Delete the ManaBox CSV Manager database.
5. Refresh the app.

This clears locally imported collections for that browser profile only.
