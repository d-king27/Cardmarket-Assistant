# Cardmarket Assistant Contracts

This private monorepo package is the single source of truth for data exchanged
between the data tool, Playwright companion, and browser extension.

It exports Zod runtime schemas and their inferred TypeScript types for:

- queue preparation requests, previews, manifests, and statuses;
- listing batches and listing records;
- Cardmarket page context;
- fill results and batch results.

The package exports compiled ESM and declarations from `dist`. `npm install`
runs its `prepare` script, and `dist` remains a generated, ignored directory.

## Validate

```powershell
npm install
npm run build
npm run check
npm test
```

## Changing a Contract

Additive changes to optional fields may keep the current protocol version.
Breaking field, meaning, or validation changes must:

1. increment the relevant version constant;
2. add tests for the old-version rejection and new-version acceptance;
3. update all three consumers in the same commit;
4. update `docs/shared-contracts.md`.
