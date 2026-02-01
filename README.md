# React TS Template

A modern React + TypeScript SPA template built with Vite, ready for GitHub Copilot agents.

> Based on [Vite's official React TypeScript template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts)

## Features

- **React 19** - Latest React with modern features
- **TypeScript** - Strict mode enabled for type safety
- **Vite 6** - Lightning-fast development and builds
- **Vitest 3** - Fast unit testing with React Testing Library
- **ESLint** - Code linting with React-specific rules
- **GitHub Actions** - CI/CD with automatic GitHub Pages deployment
- **Agent-Ready** - AGENTS.md and copilot-instructions.md for AI coding assistants

## Prerequisites

- **Node.js 22+** - Use [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm)

```bash
# Install fnm (Fast Node Manager)
# macOS/Linux
curl -fsSL https://fnm.vercel.app/install | bash

# Windows (PowerShell)
winget install Schniz.fnm
```

## Quick Start

```bash
# Clone this repository
git clone <your-repo-url>
cd react-ts-template

# Install Node.js (uses .node-version file)
fnm use

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 to see the app.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR; serves unbundled source for fast iteration |
| `npm run build` | Build for production to `dist/` |
| `npm run preview` | Serve built `dist/` locally for final QA (run `build` first) |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run lint` | Lint code with ESLint |

## Project Structure

```
├── .github/
│   ├── copilot-instructions.md    # GitHub Copilot instructions
│   └── workflows/
│       ├── ci.yml                  # CI pipeline (lint, test, build)
│       └── deploy.yml              # Deploy to GitHub Pages
├── public/                         # Static files served as-is
├── src/
│   ├── assets/
│   │   └── react.svg               # Example static asset
│   ├── components/
│   │   └── Button/
│   │       ├── Button.css          # Component styles
│   │       ├── Button.test.tsx     # Component tests
│   │       ├── Button.tsx          # Component implementation
│   │       └── index.ts            # Barrel export
│   ├── hooks/
│   │   ├── useCounter.test.ts      # Hook tests
│   │   └── useCounter.ts           # Example custom hook
│   ├── test/
│   │   └── setup.ts                # Vitest setup
│   ├── utils/
│   │   ├── formatDate.test.ts      # Utility tests
│   │   └── formatDate.ts           # Example utility functions
│   ├── App.css                     # App component styles
│   ├── App.test.tsx                # App tests
│   ├── App.tsx                     # Root component
│   ├── index.css                   # Global styles
│   ├── main.tsx                    # Entry point
│   └── vite-env.d.ts               # Vite type definitions
├── .node-version                   # Node version for fnm
├── .nvmrc                          # Node version for nvm
├── AGENTS.md                       # AI coding agent instructions
├── eslint.config.js                # ESLint configuration
├── index.html                      # HTML entry point
├── package.json                    # Dependencies and scripts
├── tsconfig.app.json               # App TypeScript config
├── tsconfig.json                   # Base TypeScript config
├── tsconfig.node.json              # Node TypeScript config
└── vite.config.ts                  # Vite + Vitest config
```

## Development Workflow

### Before Committing

```bash
npm run lint          # Check for lint errors
npm run test:run      # Run all tests
npx tsc --noEmit      # Type check
```

### Adding New Components

1. Create component in `src/components/`
2. Add tests in the same directory
3. Run tests to verify

See `src/components/Button/` for an example component with tests.

## Deployment

### GitHub Pages

The repository is configured for automatic deployment to GitHub Pages.

**First-time setup (required):**

1. Go to repository **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**

Once enabled, every push to `main` will automatically build and deploy your site.

## AI Agent Support

This repository includes configuration files for AI coding agents:

- **AGENTS.md** - Detailed instructions for AI agents (commands, code style, boundaries)
- **.github/copilot-instructions.md** - GitHub Copilot-specific instructions

These files help AI assistants understand the project structure, coding conventions, and what they should/shouldn't modify.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI library |
| TypeScript | 5.7.x | Type safety |
| Vite | 6.x | Build tool |
| Vitest | 3.x | Test framework |
| ESLint | 9.x | Code linting |
| React Testing Library | 16.x | Component testing |

## License

MIT
