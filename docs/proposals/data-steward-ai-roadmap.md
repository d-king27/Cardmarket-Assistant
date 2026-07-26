# Data Steward And AI Roadmap

## Purpose

This proposal describes the later Data Steward and AI phase for Cardmarket
Assistant. It is intentionally separate from the first integrated Cardmarket
workflow.

The initial workflow does not require AI. CSV validation, grouping, splitting,
queue creation, Cardmarket page preparation, and result tracking should all be
deterministic application features. AI may translate a natural-language request
into the same validated operation plan, but it must remain optional.

The later AI phase should add research, recommendations, and explanations
without allowing a model to mutate inventory or create listings directly.

## Design Principles

- Keep the application useful when no AI provider or API key is configured.
- Treat agents as planners and analysts, not mutation engines.
- Validate every agent response against a versioned runtime schema.
- Preview proposed changes before approval.
- Apply approved changes with deterministic executors.
- Record source data, provider, model, prompt version, confidence, and time.
- Preserve audit and undo support.
- Never present inferred or speculative data as observed fact.
- Do not use the authenticated Cardmarket browser session as a general scraping
  mechanism.

The standard write path should be:

```text
Agent researches or proposes
  -> typed plan and preview
  -> user approval
  -> deterministic executor
  -> audit entry and undo data
```

## Foundation Work

### Align Plans With Implemented Operations

The current Steward schemas describe more operations than the executor applies.
Before adding more agents:

1. Give every advertised operation a preview and deterministic executor.
2. Remove operations from model-facing schemas until their executors exist.
3. Add contract tests proving that every accepted operation can be previewed,
   applied, audited, and undone.
4. Record the real model and provider used to create a plan instead of labeling
   all applied plans as local deterministic work.

### Provider-Independent Agent Runtime

Replace the provider-specific Steward call path with an agent runtime that owns:

- provider and model configuration;
- tool registration;
- structured response validation;
- timeouts, retries, and rate limits;
- prompt and tool-contract versions;
- run status and error reporting;
- token or usage metadata where available;
- deterministic fallback selection.

An individual agent should depend on domain tools and schemas rather than an
Anthropic-specific SDK response shape.

### Canonical Card Identity

Introduce a stable local identity layer capable of linking:

- collection row ID;
- ManaBox ID;
- Scryfall ID;
- MTGJSON UUID;
- Cardmarket product ID;
- game, set, collector number, finish, and language.

Identity resolution must represent confidence and ambiguity explicitly. A weak
name match must not silently become a Cardmarket product identity.

Suggested entities:

```text
cardIdentities
identityCandidates
providerIdentifiers
identityResolutionRuns
```

### Shared Local Persistence

IndexedDB is appropriate for the current browser-only MVP, but background
agents and Playwright cannot use it directly. When agent work begins, introduce
a repository abstraction and move authoritative shared data to a local database
such as SQLite.

The React UI can remain local-first while accessing inventory through the local
application service. A migration must preserve existing collections, audit
entries, and imported source metadata.

### Common Agent Records

Store agent activity independently from inventory changes:

```text
agentRuns
  id
  agentType
  collectionId
  provider
  model
  promptVersion
  toolContractVersion
  startedAt
  completedAt
  status
  warnings

recommendations
  id
  runId
  collectionCardId
  type
  proposedValue
  rationale
  classification
  confidence
  sourceAge
  status

dataSources
  id
  runId
  provider
  providerRecordId
  observedAt
  retrievedAt
  completeness
```

## Recommended Agent Order

### 1. Data Quality And Update Agent

This should be the first new agent because pricing and deckbuilding both depend
on reliable identities and normalized metadata.

Responsibilities:

- resolve missing or conflicting card identities;
- normalize set codes, set names, finishes, languages, and conditions;
- identify duplicate or potentially duplicate records;
- identify stale or incomplete metadata;
- propose corrections with confidence and provenance;
- create a manual-review queue for ambiguous matches.

Suggested tools:

```text
resolve_card_identities
fetch_card_metadata
compare_inventory_metadata
detect_duplicate_candidates
propose_metadata_updates
```

External metadata should be cached and timestamped. Updates should be proposed
as ordinary typed field changes and applied only after approval.

### 2. Pricing Analyst

The Pricing Analyst should fetch market references, detect meaningful
differences, and propose target prices. It should never price cards by guessing
from the language model.

Responsibilities:

- obtain timestamped pricing snapshots from approved providers;
- apply a user-selected pricing policy;
- flag missing, stale, sharply changed, or low-confidence prices;
- distinguish observed, inferred, and speculative recommendations;
- propose changes to `targetPrice`;
- preserve the underlying source values used for every recommendation.

Suggested tools:

```text
fetch_pricing_snapshot
analyze_price_movements
apply_pricing_policy
propose_price_updates
explain_pricing_rationale
```

The first version should be a review assistant, not an autonomous pricing bot.
Speculative recommendations should be watchlist items and must never be
batch-approved as direct price changes.

The detailed pricing design remains in
`proposals/pricing-analyst-proposal.txt`.

### 3. Deckbuilding Agent

The Deckbuilding Agent should work against owned inventory, format constraints,
and an explicit budget or objective.

Possible inputs:

- game and format;
- commander, colours, archetype, or theme;
- desired power level;
- owned-cards-only or shopping allowed;
- budget;
- preferred and excluded cards;
- printing and condition preferences.

Possible outputs:

- proposed deck list;
- owned cards available for the deck;
- missing cards and estimated acquisition list;
- legal or format-related warnings;
- substitutions ranked by confidence;
- a proposed deck collection;
- cards to keep, acquire, or release.

Suggested tools:

```text
search_owned_cards
fetch_card_rules_and_legality
validate_deck_constraints
find_owned_substitutions
estimate_missing_card_costs
propose_deck_collection
```

Rules text, legality, and pricing are time-sensitive external data. The agent
must use current provider data rather than relying on model memory.

### 4. Inventory Reconciliation Agent

Add reconciliation after the queue and listing-result contracts are stable.

Responsibilities:

- compare imports and later inventory snapshots;
- connect Cardmarket queue results with source collection rows;
- identify listings that failed, were skipped, or need retrying;
- detect quantity drift;
- propose corrective inventory updates;
- produce an exceptions report rather than silently reconciling conflicts.

### Other Possible Agents

Later candidates include:

- a collection valuation and reporting agent;
- a trade or sale preparation agent;
- a stale-price/watchlist monitor;
- a purchase-list optimizer;
- a collection-insight agent for set, rarity, colour, or archetype analysis.

Each candidate should be introduced only when it has a reliable deterministic
tool layer and a clear approval boundary.

## Safety And Governance

### Mutation Boundary

Agents must never write directly to inventory, queue files, browser forms, or
Cardmarket. They may only return validated plans or recommendations.

### External Data

- Prefer documented and permitted APIs or imported datasets.
- Cache responses according to provider terms and rate limits.
- Store retrieval and observation times separately.
- Mark missing and partial data clearly.
- Keep external research independent from the authenticated listing session.

### Confidence

Use a small consistent vocabulary:

- `high`: stable identity and direct supporting data;
- `medium`: supported but requires a documented assumption;
- `low`: ambiguous, incomplete, or weakly inferred.

Low-confidence identity, pricing, and metadata changes should require individual
review.

### Evaluation

Maintain repeatable evaluation fixtures for:

- ambiguous names and printings;
- set and collector-number conflicts;
- foil and etched finishes;
- multilingual cards;
- duplicate detection;
- missing and stale pricing data;
- large price changes;
- deck legality and owned-card substitutions;
- malformed or unsafe agent plans.

Every agent release should include contract tests, deterministic executor tests,
and representative end-to-end previews.

## Delivery Sequence

1. Complete and test the deterministic operation engine.
2. Add the provider-independent runtime and common run records.
3. Add canonical identity resolution and a manual-review UI.
4. Introduce shared local persistence for the UI, agents, and queue controller.
5. Deliver the Data Quality and Update Agent.
6. Deliver the Pricing Analyst.
7. Deliver the Deckbuilding Agent.
8. Add reconciliation and optional specialist agents.

This roadmap should begin only after the first integrated Cardmarket queue flow
is reliable. AI should enhance that workflow later, not become a dependency for
using it.
