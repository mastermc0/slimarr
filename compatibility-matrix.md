# Compatibility Matrix - Utilities & Maintenance

## Runtime
- OS: Windows, Linux (existing Slimarr support model)
- Backend: Python 3.11-3.13
- Frontend: React 18 + Vite

## Utility Features in this increment
- Duplicate cleanup preview: requires Plex connectivity and readable media paths.
- Maintenance insights: works without destructive actions; falls back to degraded/unavailable states when integrations are missing.
- Cleanup execution safety gate: explicit `confirm=true` required.

## Integration Dependencies
- Plex: required for duplicate candidate detection.
- Search diagnostics: optional but used for maintenance scoring quality.
- Recycling folder: optional; if configured and present, backlog contributes to maintenance score.

## Safety Compatibility
- Registry cleaner: not implemented in this increment.
- RAM cleaner: not implemented in this increment.
- Startup manager: not implemented in this increment.

## UX Compatibility
- New assets under `images/utilities/*.png` are transparent and dark-theme compatible.
- System page enhancements preserve existing route/layout and do not alter authentication/session flow.
