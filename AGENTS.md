# AGENTS.md

You are an expert React TypeScript developer working on an Azure OpenAI chat application.

## Project Knowledge

- **App:** Chat interface for Azure OpenAI Responses API with streaming
- **Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, OpenAI SDK 6
- **Node Version:** 20+ (use fnm or nvm with `.node-version` or `.nvmrc`)
- **Package Manager:** npm

### File Structure

```
src/
├── components/              # React UI components
│   ├── Button/              # Reusable button
│   ├── ChatContainer/       # Main chat layout with header
│   ├── ChatInput/           # Message input and send button
│   ├── Message/             # Individual message display
│   ├── MessageList/         # Scrollable message container
│   ├── ReasoningBox/        # Collapsible reasoning display
│   ├── SettingsButton/      # Header settings trigger
│   ├── SettingsSidebar/     # Configuration panel
│   └── ToolCallBox/         # Function call display
├── context/
│   └── SettingsContext.tsx  # Global settings provider
├── hooks/
│   ├── useChat.ts           # Chat state and streaming API
│   └── useSettings.ts       # Settings with localStorage
├── types/
│   └── index.ts             # Shared TypeScript types
├── utils/
│   ├── api.ts               # Azure OpenAI client utilities
│   └── localStorage.ts      # Storage helpers
├── test/
│   └── setup.ts             # Vitest setup
├── App.tsx                  # Root component (SettingsProvider + ChatContainer)
├── main.tsx                 # Entry point
└── index.css                # Global styles
```

- `public/` – Static files served as-is
- `dist/` – Build output (gitignored)
- `.github/workflows/` – CI/CD configurations

## Key Architecture

- **Settings Context** - Global settings via React context, persisted to localStorage
- **useChat Hook** - Manages messages array, streaming state, and API calls
- **Responses API** - Uses OpenAI SDK with `client.responses.create({ stream: true })`
- **Conversation Continuity** - Tracks `previous_response_id` for multi-turn conversations
- **Streaming Events** - Handles `response.output_text.delta`, `response.reasoning_summary_text.delta`, `response.function_call_arguments.delta`, etc.

## Commands You Can Use

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server with HMR; serves unbundled source for fast iteration |
| `npm run build` | TypeScript check + production build to `dist/` |
| `npm run preview` | Serve built `dist/` locally for final QA (run `build` first) |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once (CI mode) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |

> **Note:** Always use `npm run test` or `npm run test:run` instead of `npx vitest`. The npm scripts ensure consistent configuration and avoid potential version mismatches.

## Code Style

### TypeScript Practices

- Use TypeScript strict mode (enabled in `tsconfig.app.json`)
- Prefer `interface` for component props
- Use explicit return types for exported functions
- Never use `any` – prefer `unknown` for truly unknown types
- **Never use `JSX.Element`** as a return type – use `ReactNode` from `'react'` or omit the return type and let TypeScript infer it

### React Patterns

```tsx
// ✅ Good - typed props with interface
interface ButtonProps {
  /** Button label text */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Optional disabled state */
  disabled?: boolean;
}

function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// ❌ Bad - untyped or any
function Button({ label, onClick }: any) {
  return <button onClick={onClick}>{label}</button>;
}
```

### Naming Conventions

- **Components:** PascalCase (`MyComponent.tsx`)
- **Hooks:** camelCase with `use` prefix (`useCustomHook.ts`)
- **Utilities:** camelCase (`formatDate.ts`)
- **Test files:** `*.test.tsx` or `*.spec.tsx`
- **CSS:** Match component name (`App.css` for `App.tsx`)

### File Organization

Follow the existing structure in `src/`. See examples:

- **Components:** `src/components/ChatContainer/` – Main layout with sub-components
- **Hooks:** `src/hooks/useChat.ts` – State management with API integration
- **Context:** `src/context/SettingsContext.tsx` – Global state providers
- **Types:** `src/types/index.ts` – Shared type definitions
- **Utilities:** `src/utils/api.ts` – Azure OpenAI client helpers

## Testing Instructions

- Tests use Vitest + React Testing Library
- Test files should be co-located with source files or in `src/test/`
- Run `npm run test:run` before committing
- All tests must pass before merging
- **Always add unit tests when implementing new features** – new utilities, hooks, and components should have corresponding `.test.ts` or `.test.tsx` files

```tsx
// ✅ Good test pattern
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders with label', () => {
    render(<Button label="Click me" onClick={() => {}} />)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })
})
```

> **Note:** Always import all test utilities you use (`describe`, `it`, `expect`, `beforeEach`, `afterEach`, `vi`, etc.) explicitly from `'vitest'`. Unlike Jest, Vitest does not expose these as globals by default, so missing imports cause TypeScript errors.

## Build and Deploy

- Production builds go to `dist/` directory
- GitHub Actions automatically deploys to GitHub Pages on push to `main`
- The build uses relative paths (`base: './'`) for GitHub Pages compatibility

## Boundaries

### ✅ Always Do

- Write TypeScript (never plain JavaScript)
- Add tests for new components and utilities
- Run `npm run lint` and `npm run test:run` before commits
- Use semantic HTML elements
- Follow existing code patterns and file structure

### ⚠️ Ask First

- Adding new dependencies
- Changing build configuration (`vite.config.ts`)
- Modifying CI/CD workflows
- Major architectural changes

### 🚫 Never Do

- Commit secrets, API keys, or credentials
- Modify `node_modules/` or `dist/`
- Use `any` type without justification
- Remove failing tests without fixing them
- Commit generated JavaScript files (TypeScript source is canonical)
