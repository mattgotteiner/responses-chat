# Copilot Instructions

This is a React + TypeScript chat interface for Azure OpenAI's Responses API.

For detailed coding guidelines, architecture, and patterns, see [AGENTS.md](../AGENTS.md) in the repository root.

## Quick Reference

- **Build:** `npm run build` (TypeScript + Vite build to `dist/`)
- **Test:** `npm run test:run` (Vitest in CI mode)
- **Lint:** `npm run lint` (ESLint)
- **Typecheck:** `npm run typecheck` (TypeScript without emitting)
- **Dev:** `npm run dev` (Vite dev server)

## Project Structure

```
src/components/  - Chat UI components (ChatContainer, Message, etc.)
src/context/     - Settings context provider
src/hooks/       - useChat, useSettings hooks
src/types/       - TypeScript type definitions
src/utils/       - API client and localStorage helpers
src/test/        - Test setup
public/          - Static files
dist/            - Build output (gitignored)
```

## Key Constraints

- TypeScript strict mode enabled
- React 19 + Vite 7 + Vitest 4 + OpenAI SDK 6
- Node 20+ required (see `.node-version`)
- All code must be TypeScript (no .js source files)
- Tests required for new functionality

## Before Committing

1. `npm run build` - TypeScript check + production build
2. `npm run lint` - Fix any linting errors
3. `npm run test:run` - All tests must pass

## Deployment

Pushing to `main` triggers automatic deployment to GitHub Pages via GitHub Actions.
