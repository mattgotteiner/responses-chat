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

- **Node.js 20+** - Use [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm)
- **Azure OpenAI Resource** - With a deployed model supporting the Responses API

## Quick Start

```bash
# Clone this repository
git clone https://github.com/mattgotteiner/responses-chat
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
│   │   ├── AttachmentButton/        # File attachment trigger
│   │   ├── AttachmentPreview/       # Attachment thumbnail display
│   │   ├── Button/                  # Reusable button component
│   │   ├── ChatContainer/           # Main chat layout
│   │   ├── ChatInput/               # Message input with send button
│   │   ├── JsonSidePanel/           # JSON viewer side panel
│   │   ├── McpServerSettings/       # MCP server configuration
│   │   ├── Message/                 # Individual message display
│   │   ├── MessageList/             # Scrollable message container
│   │   ├── ReasoningBox/            # Collapsible reasoning display
│   │   ├── SettingsButton/          # Header settings trigger
│   │   ├── SettingsSidebar/         # Configuration panel
│   │   ├── TokenUsageDisplay/       # Token usage statistics
│   │   └── ToolCallBox/             # Function call display
│   ├── context/
│   │   └── SettingsContext.tsx      # Global settings provider
│   ├── hooks/
│   │   ├── useChat.ts               # Chat state and API calls
│   │   └── useSettings.ts           # Settings with localStorage
│   ├── test/
│   │   ├── setup.ts                 # Vitest setup
│   │   ├── helpers.ts               # Test helper utilities
│   │   └── e2e/                     # End-to-end tests
│   ├── types/
│   │   └── index.ts                 # TypeScript type definitions
│   ├── utils/
│   │   ├── api.ts                   # Azure OpenAI client utilities
│   │   ├── attachment.ts            # Attachment processing
│   │   ├── localStorage.ts          # Storage helpers
│   │   ├── recording.ts             # Recording file utilities
│   │   ├── recordingReplay.ts       # Recording replay for tests
│   │   ├── streamProcessor.ts       # Streaming response processor
│   │   └── tokenUsage.ts            # Token usage calculations
│   ├── App.tsx                      # Root component
│   ├── main.tsx                     # Entry point
│   └── index.css                    # Global styles
├── recordings/                       # API response recordings for tests
├── AGENTS.md                         # AI coding agent instructions
├── package.json                    # Dependencies and scripts
└── vite.config.ts                  # Vite configuration
```

## Development Workflow

### Before Committing

```bash
npm run lint          # Check for lint errors
npm run test:run      # Run all tests
npm run typecheck     # Type check
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

## Record Mode

Record mode captures wire-level API requests and responses for creating e2e test fixtures. When enabled, each conversation generates a JSONL file that can be used to replay API interactions without making actual API calls.

### Enabling Record Mode

Set the `VITE_RECORD_MODE` environment variable when starting the dev server:

```bash
# Windows PowerShell
$env:VITE_RECORD_MODE="true"; npm run dev

# macOS/Linux
VITE_RECORD_MODE=true npm run dev
```

### How It Works

1. When you send a message, the app captures all streaming response events from the API
2. On conversation completion, a JSONL file automatically downloads to your browser's download folder
3. File naming format: `recording-{guid}.jsonl`

### JSONL File Format

Each file contains one JSON object per line. The first line is the request payload, followed by streaming response events:

```jsonl
{"type":"request","timestamp":0,"data":{"model":"gpt-5","input":"Hello!","reasoning":{"effort":"low","summary":"detailed"}}}
{"type":"response.created","timestamp":1165,"data":{"type":"response.created","sequence_number":0,"response":{"id":"resp_...","status":"in_progress",...}}}
{"type":"response.in_progress","timestamp":1212,"data":{"type":"response.in_progress","sequence_number":1,...}}
{"type":"response.output_text.delta","timestamp":1250,"data":{"type":"response.output_text.delta","delta":"Hi",...}}
{"type":"response.completed","timestamp":2500,"data":{"type":"response.completed","response":{"id":"resp_...","status":"completed",...}}}
```

**Line structure:**
- `type` - Event type (`request` for the first line, SDK event types for subsequent lines)
- `timestamp` - Milliseconds since session start (always `0` for request)
- `data` - Full event payload from the SDK

### Loading Recordings

Use the `loadRecording()` utility to parse recording files:

```typescript
import { loadRecording } from './utils/recording';

const content = await fetch('/recordings/example.jsonl').then(r => r.text());
const recording = loadRecording(content);

console.log(recording.request.data);  // Original request payload
console.log(recording.events);        // Array of streaming events
```

### Recordings Directory

Downloaded recordings can be moved to the `recordings/` directory (gitignored) for organization. This directory is intended for storing test fixtures.

### Use Cases

- **E2E Testing**: Replay recorded API responses without spending tokens
- **Debugging**: Inspect exact wire-level data exchanged with the API
- **Development**: Test UI changes against known API response patterns

## Deployment

### GitHub Pages

The repository is configured for automatic deployment to GitHub Pages.

**First-time setup (required):**

1. Go to repository **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**

Once enabled, every push to `main` will automatically build and deploy your site.

## Security Considerations

This is a client-side application designed for local development and testing:

- **API Key Storage** – Keys are stored in browser localStorage (unencrypted). Only use on trusted devices. Clear browser data when finished on shared machines.
- **Browser SDK Usage** – The OpenAI SDK runs with `dangerouslyAllowBrowser: true`, which is required for browser-based API calls. This means credentials are accessible in client-side code.

## Known Limitations

### Code Interpreter Cancellation

When using Code Interpreter and the model executes an infinite loop or long-running code, **there is no API to immediately terminate the execution**. The "Stop" button in the UI will abort the streaming connection (stop receiving events), but the server-side code execution continues until:

- The **20-minute idle timeout** kicks in
- The **1-hour maximum session lifetime** expires
- Azure's internal sandbox limits are reached

The Azure OpenAI Responses API does not expose a container management endpoint to delete or terminate Code Interpreter containers directly. Background mode (`background: true`) does support a `/cancel` endpoint, but adds latency that's not ideal for interactive chat.

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
