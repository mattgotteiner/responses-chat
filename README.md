# Responses Chat

A React + TypeScript chat interface for Azure OpenAI's Responses API with streaming support.

## Features

- **Azure OpenAI Integration** - Uses the Responses API with streaming
- **Conversation Continuity** - Maintains context via `previous_response_id`
- **Reasoning Display** - Shows model reasoning steps in collapsible boxes
- **Tool Call Support** - Displays function calls made by the model
- **Settings Sidebar** - Configure endpoint, API key, model, reasoning effort, and more
- **Local Storage** - Settings persist across sessions
- **React 19 + TypeScript** - Modern stack with strict type checking
- **Vite 7** - Lightning-fast development and builds

## Prerequisites

- **Node.js 22+** - Use [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm)
- **Azure OpenAI Resource** - With a deployed model supporting the Responses API

## Quick Start

```bash
# Clone this repository
git clone <your-repo-url>
cd responses-chat

# Install Node.js (uses .node-version file)
fnm use

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 and configure your Azure OpenAI settings to start chatting.

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
│   ├── components/
│   │   ├── Button/                 # Reusable button component
│   │   ├── ChatContainer/          # Main chat layout
│   │   ├── ChatInput/              # Message input with send button
│   │   ├── Message/                # Individual message display
│   │   ├── MessageList/            # Scrollable message container
│   │   ├── ReasoningBox/           # Collapsible reasoning display
│   │   ├── SettingsButton/         # Header settings trigger
│   │   ├── SettingsSidebar/        # Configuration panel
│   │   └── ToolCallBox/            # Function call display
│   ├── context/
│   │   └── SettingsContext.tsx     # Global settings provider
│   ├── hooks/
│   │   ├── useChat.ts              # Chat state and API calls
│   │   └── useSettings.ts          # Settings with localStorage
│   ├── test/
│   │   └── setup.ts                # Vitest setup
│   ├── types/
│   │   └── index.ts                # TypeScript type definitions
│   ├── utils/
│   │   ├── api.ts                  # Azure OpenAI client utilities
│   │   └── localStorage.ts         # Storage helpers
│   ├── App.tsx                     # Root component
│   ├── main.tsx                    # Entry point
│   └── index.css                   # Global styles
├── AGENTS.md                       # AI coding agent instructions
├── package.json                    # Dependencies and scripts
└── vite.config.ts                  # Vite configuration
```

## Development Workflow

### Before Committing

```bash
npm run lint          # Check for lint errors
npm run test:run      # Run all tests
npx tsc --noEmit      # Type check
```

## Configuration

Open the settings sidebar (gear icon) to configure:

| Setting | Description |
|---------|-------------|
| Endpoint | Azure OpenAI endpoint URL |
| API Key | API key for authentication |
| Model | Select from available models (gpt-5-nano, gpt-5-mini, etc.) |
| Deployment Name | Optional custom deployment name |
| Reasoning Effort | none, minimal, low, medium, high |
| Reasoning Summary | auto, concise, detailed |
| Verbosity | low, medium, high |
| Developer Instructions | System-level instructions for the model |

## Deployment

### GitHub Pages

The repository is configured for automatic deployment to GitHub Pages.

**First-time setup (required):**

1. Go to repository **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**

Once enabled, every push to `main` will automatically build and deploy your site.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI library |
| TypeScript | 5.9.x | Type safety |
| Vite | 7.x | Build tool |
| Vitest | 4.x | Test framework |
| OpenAI SDK | 6.x | Azure OpenAI API client |
| ESLint | 9.x | Code linting |

## License

MIT
