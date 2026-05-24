# Telemetry Engine Notes (Utilities Integration)

This document summarizes utility-to-telemetry integration points used by the maintenance experience.

## Current Utility Telemetry Inputs
- System health matrix (`/api/v1/system/health/matrix`): API, DB, scheduler, queue, integrations, search pipeline.
- Search degradation signals (`backend.core.search_diagnostics`).
- Recycling bin live stats (`/api/v1/system/recycling-bin`).
- Duplicate cleanup preview scan (`/api/v1/system/cleanup/preview`).

## Maintenance Intelligence Contract
- Endpoint: `/api/v1/system/utilities/maintenance-insights`
- Output:
  - `maintenance_score` (0-100)
  - `maintenance_state` (excellent/good/attention/critical)
  - telemetry-backed `signals`
  - safe `recommendations`
  - summarized `telemetry` payload for UI display

## Design Guardrails
- No fake optimization deltas.
- No claims without measurable signal sources.
- No unsafe cleaner behavior introduced through telemetry decisions.
- Keep calculations lightweight and bounded.

## Resource Efficiency
- Utility page polling is reduced for hidden tabs.
- Duplicate preview sampling is bounded (`max_movies_per_section`) for predictable overhead.
