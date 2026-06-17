# NEXO Landing Page Creator v3.0

> **AI-powered autonomous landing page creation micro-product.** Users chat with AI to generate, preview, and deploy production-ready landing pages in minutes.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Services](#services)
- [Agent Swarm](#agent-swarm)
- [Development](#development)
- [Deployment](#deployment)

---

## Overview

NEXO Landing Page Creator v3.0 is a micro-product that enables users to create professional landing pages through natural language conversation with AI. The system handles the entire lifecycle: idea, generation, preview, bug detection, auto-rebuild, and deployment.

### Key Features

- **AI-Powered Generation** - Chat-based landing page creation via Kimi Bridge
- **Real-time Preview** - Instant HTML preview with hot reload
- **Bug Detection** - Automated validation and issue detection
- **Auto-Rebuild** - Intelligent fix loops (up to 3 attempts)
- **Token System** - Usage-based billing with initial free credits
- **GitHub Pages Deploy** - One-click deployment with ZIP fallback
- **Template Mining** - Extract and catalog reusable templates
- **SSE Streaming** - Real-time generation event streaming
- **Multi-Stack Support** - React + Tailwind, Vue, HTML/CSS, Next.js

---

## Architecture

```
nexo-lp-creator/
|-- nexo-lp-server/           # Express backend
|   |-- nexo-lp-server.js     # Entry point
|   |-- nexo-lp-routes.js     # API routes
|   |-- config/               # Configuration
|   |-- models/               # Database layer
|   |   |-- sqlite.js         # Connection & migrations
|   |   |-- migrations/       # Schema migrations
|   |   '-- repositories/     # Data access layer
|   |-- services/             # Business logic (12 services)
|   |-- agents/               # AI orchestrator
|   '-- workers/              # Background workers
|-- nexo-lp-web/              # Frontend (separate)
|-- scripts/                  # Automation scripts
|-- data/                     # SQLite DB + previews
|-- logs/                     # Application logs
|-- package.json
|-- .env.example
|-- pm2-ecosystem.config.js
|-- README.md
'-- AGENTS.md
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express 4.x |
| Database | SQLite (better-sqlite3) |
| AI Bridge | Kimi Bridge API |
| Deployment | GitHub Pages + ZIP fallback |
| Process Manager | PM2 |

---

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd nexo-lp-creator

# Run automated setup
npm run setup

# Or manually:
cp .env.example .env
# Edit .env with your credentials
npm install
cd nexo-lp-web && npm install && cd ..
npm run build:web
```

### Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3460 |
| `KIMI_CDP_URL` | Chrome DevTools Protocol URL | `http://127.0.0.1:9226` |
| `KIMI_CDP_PORT` | Isolated CDP port for the LP Creator Chrome | `9226` |
| `KIMI_CHROME_USER_DATA_DIR` | Isolated Chrome profile for the LP Creator (must differ from the Luna dashboard profile) | `~/.luna/nexo-lp-chrome-profile` |
| `KIMI_MAX_PAGES` | Max concurrent Kimi pages | `1` |
| `KIMI_BRIDGE_REUSE_USER_ID` | Reuse the same Kimi tab across requests | `false` |
| `KIMI_BRIDGE_FIXED_USER_ID` | Fixed userId when reuse is enabled | - |
| `GITHUB_TOKEN` | GitHub personal access token | - |
| `DATABASE_PATH` | SQLite database file | `./data/nexo-lp.db` |
| `DEFAULT_TOKEN_BALANCE` | Initial tokens for new users | 50 |

### Running

```bash
# Development (server + web)
./scripts/start-server.sh   # Backend on port 3460 with isolated Kimi Chrome
npm run dev:web             # Frontend (separate terminal)

# Production
npm run build
npm start

# With PM2
pm2 start pm2-ecosystem.config.js
```

---

## API Reference

### Base URL

```
http://localhost:3460/api/nexo-lp
```

### Endpoints

#### Sessions

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions` | Create new session |
| `GET` | `/sessions/:id` | Get session by ID |
| `GET` | `/sessions/:id/messages` | Get chat messages |
| `POST` | `/sessions/:id/messages` | Add a chat message |

#### Generation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/generate` | Start generation (SSE stream) |
| `GET` | `/preview/:sessionId` | Get generated HTML preview |

#### Bug Detection & Rebuild

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bug-detect` | Run bug detection |
| `POST` | `/rebuild` | Rebuild with fixes |

#### Tokens

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tokens/balance` | Get token balance |
| `POST` | `/tokens/deduct` | Deduct tokens |

#### Deployment

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/deploy/github` | Deploy to GitHub Pages |

#### Templates

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/templates` | List all templates |
| `POST` | `/templates/:id/use` | Use a template |

#### Mining

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mining/submit` | Submit URL for mining |
| `GET` | `/mining/:jobId/status` | Check mining status |

#### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check endpoint |

### SSE Events

The `/generate` endpoint streams Server-Sent Events:

```
event: action_start
data: {"phase": "intention", "message": "Analyzing requirements..."}

event: action_end
data: {"phase": "intention", "result": "..."}

event: thinking_start
data: {"phase": "code", "message": "Thinking..."}

event: thinking_delta
data: {"phase": "code", "text": "...", "fullThinking": "..."}

event: response_delta
data: {"phase": "code", "text": "...", "fullResponse": "..."}
```

**Phases:** `intention` -> `structure` -> `code` -> `review` -> `preview` -> `deploy`

---

## Services

The backend consists of 12 specialized services:

| Service | File | Responsibility |
|---------|------|---------------|
| Session Service | `lpSessionService.js` | CRUD for sessions |
| Token Service | `lpTokenService.js` | Token balance & deduction |
| Generation Service | `lpGenerationService.js` | AI generation orchestration |
| Preview Service | `lpPreviewService.js` | HTML preview serving |
| Deploy Service | `lpDeployService.js` | GitHub Pages + ZIP deploy |
| Template Service | `lpTemplateService.js` | Template CRUD |
| Stack Service | `lpStackService.js` | Stack selection & validation |
| Build Verification | `lpBuildVerificationService.js` | Pre/post build checks |
| Bug Detector | `lpBugDetectorService.js` | Validation & issue detection |
| Rebuild Engine | `lpRebuildEngine.js` | Auto-fix loops (max 3) |
| Mining Service | `lpMiningService.js` | Template mining pipeline |
| Bridge Adapter | `lpBridgeAdapter.cjs` | Kimi bridge integration |

---

## Agent Swarm

The system uses a luna-soul pattern orchestrator that coordinates AI agents for different phases of landing page creation. See [AGENTS.md](AGENTS.md) for detailed documentation.

---

## Development

### Running Tests

```bash
npm test              # Run all tests
npm run integrate     # Run integration suite
npm run test:e2e      # Run Playwright E2E tests (visible browser)
```

The E2E suite simulates a real user creating a landing page end-to-end and verifies:
- Preview is rendered with Tailwind CSS styling
- Chat messages persist after reload
- Chat container scrolls with new messages
- The Kimi bridge keeps only one tab open on the isolated CDP port

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/setup.sh` | Initial project setup |
| `scripts/dev.sh` | Start dev environment |
| `scripts/build.sh` | Build production bundle |
| `scripts/test.sh` | Run test suite |
| `scripts/verify-build.sh` | Verify build artifacts |
| `scripts/run-reviewers.sh` | Run code reviewers |
| `scripts/run-all-tests.sh` | Run all test suites |

---

## Deployment

### GitHub Pages

1. Configure `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPO` in `.env`
2. Use the `/deploy/github` endpoint or CLI
3. Pages will be deployed to `https://<owner>.github.io/<repo>/`

### PM2 Production

```bash
pm2 start pm2-ecosystem.config.js --env production
pm2 save
pm2 startup
```

---

## License

MIT
