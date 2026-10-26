# Project Architecture Overview

This document provides a high-level view of the system structure, key modules, and build/test commands.

## Repository Layout

- `/backend` — Express/TypeScript server implementing API endpoints and data pipelines.
  - `src/app.ts` — Entry point that configures middleware and routes.
  - `src/routes` & `src/controllers` — Route definitions and controller logic for each API resource.
  - `src/services` — Clients for external APIs and pipeline orchestration (LLM streaming, etc.).
  - `src/pipeline` — Core step-by-step data processing logic for trial site recommendations.
  - `src/repository` — Data persistence layer (e.g., save/list runs).
  - `src/middleware` — Error handling and request wrappers.
  - `src/utils` — Shared helpers and error types.
  - `tsconfig.json` — TypeScript configuration.
  - `package.json` — Dependencies and scripts.

- `/frontend` — React/TypeScript single-page application using context for state management.
  - `src/index.tsx` — App bootstrap and context providers.
  - `src/components` — Reusable UI components (modals, tables, icons).
    - `runs/HistoryModal.tsx` — Modal for listing, viewing, and deleting saved runs.
  - `src/hooks` — Custom React hooks (e.g., `usePipeline`).
  - `src/context/PipelineContext.tsx` — Global state, actions, and services for pipeline and saved runs.
  - `src/services` — HTTP wrappers for API calls (`api.ts`) and resource-specific services (`runs.service.ts`).
  - `src/types.ts` — Shared TypeScript types.
  - `src/utils` — Client-side utilities.
  - `vite.config.ts` — Vite build configuration.
  - `package.json` — Dependencies and scripts.

## Key Flows

1. **Running an Analysis**
   - User submits form → `PipelineContext` triggers pipeline streaming via `pipeline.service` → updates context state per stage.

2. **Saving a Run**
   - From context state, `PipelineContext.handleSave` calls `runs.service.createRun` → reloads list.

3. **Viewing/Deleting Saved Runs**
   - `HistoryModal` loads runs via `PipelineContext.loadSavedRuns` → displays table → delete button confirms and calls `deleteSavedRun` in context, which uses `runs.service.deleteRun` → updates list and shows message.

## Build & Test Commands

### Backend

```bash
cd backend
npm ci
npm run typecheck
npm run build
```

### Frontend

```bash
cd frontend
npm ci
npm run build
```

Tests are managed per directory; run `npm test` if configured.
