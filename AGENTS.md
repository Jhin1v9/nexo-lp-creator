# Agent Swarm System Documentation

> Documentation for the NEXO Landing Page Creator v3.0 agent swarm and orchestration layer.

---

## Overview

The NEXO agent swarm uses the **luna-soul pattern** - an orchestrated multi-agent system where a central orchestrator delegates tasks to specialized agents. Each agent operates in an isolated context with specific responsibilities.

### luna-soul Pattern

```
+--------------------------------------------------+
|              lp-orchestrator.cjs                  |
|         (Central Coordination Hub)                |
+--------------------------------------------------+
   |         |          |          |         |
   v         v          v          v         v
+------+  +-------+  +------+  +-------+  +------+
|Intention|Structure|  Code  | Review  | Deploy |
| Agent  |  Agent  | Agent  |  Agent  | Agent  |
+------+  +-------+  +------+  +-------+  +------+
```

---

## Agent Lifecycle

### 1. Context Isolation

Each agent receives an isolated context containing:

```javascript
{
  userId: "nlp-{timestamp}-{hash}",
  sessionId: "uuid-v4",
  phase: "intention|structure|code|review|preview|deploy",
  input: { /* user message, requirements */ },
  memory: { /* accumulated context from previous phases */ },
  tools: [ /* available tools for this agent */ ]
}
```

When `KIMI_BRIDGE_REUSE_USER_ID=true`, the same `userId` is reused across requests so the bridge keeps a single Kimi tab open instead of creating a new tab per message. The isolated CDP port (`KIMI_CDP_PORT`, default `9226`) and isolated Chrome profile (`KIMI_CHROME_USER_DATA_DIR`, default `~/.luna/nexo-lp-chrome-profile`) prevent conflicts with other Luna Chrome instances. The profile MUST differ from the Luna dashboard profile (`~/.luna/chrome-profile`) so Chrome does not reuse an existing session and silently ignore the requested debugging port.

### 2. Event Flow

```
User Request
    |
    v
Orchestrator initializes context
    |
    v
Phase 1: Intention Agent  --> action_start / action_end
    |
    v
Phase 2: Structure Agent --> action_start / action_end
    |
    v
Phase 3: Code Agent      --> action_start / action_end
    |
    v
Phase 4: Review Agent    --> action_start / action_end
    |
    v
Phase 5: Preview Agent   --> action_start / action_end
    |
    v
Phase 6: Deploy Agent    --> action_start / action_end
    |
    v
Session Complete
```

### 3. Event Schema

All agents emit standardized events via the Bridge Adapter:

```javascript
// action_start event
{
  type: "action_start",
  phase: "intention",        // Current phase
  agent: "intention-agent",   // Agent name
  message: "...",             // Human-readable status
  timestamp: "ISO-8601",
  metadata: { /* phase-specific data */ }
}

// action_end event
{
  type: "action_end",
  phase: "intention",
  agent: "intention-agent",
  status: "success|error|partial",
  result: { /* phase output */ },
  timestamp: "ISO-8601",
  metadata: {}
}

// action_error event
{
  type: "action_error",
  phase: "intention",
  agent: "intention-agent",
  error: "Error message",
  recoverable: true|false,
  timestamp: "ISO-8601"
}

// thinking_start event (Luna-style reasoning)
{
  type: "thinking_start",
  phase: "code",
  sessionId: "...",
  message: "Thinking...",
  timestamp: "ISO-8601"
}

// thinking_delta event
{
  type: "thinking_delta",
  phase: "code",
  sessionId: "...",
  text: "...",
  fullThinking: "...",
  timestamp: "ISO-8601"
}

// response_delta event
{
  type: "response_delta",
  phase: "code",
  sessionId: "...",
  text: "...",
  fullResponse: "...",
  timestamp: "ISO-8601"
}
```

---

## Specialized Agents

### 1. Intention Agent

**Purpose:** Understand user requirements and extract landing page specifications.

**Input:**
- User's natural language message
- Any reference images or examples

**Output:**
```javascript
{
  title: "Landing Page Title",
  description: "Detailed description",
  sections: ["hero", "features", "pricing", "cta", "footer"],
  style: {
    tone: "professional|casual|luxury|minimal",
    colors: { primary: "#...", secondary: "#..." },
    typography: "modern|classic|playful"
  },
  target: {
    audience: "...",
    purpose: "lead-gen|sales|branding|launch"
  }
}
```

### 2. Structure Agent

**Purpose:** Design the page structure and component hierarchy.

**Input:**
- Intention output

**Output:**
```javascript
{
  layout: "single-page|multi-section",
  sections: [
    {
      id: "hero",
      type: "hero-section",
      components: ["heading", "subheading", "cta-button", "image"],
      order: 1
    }
    // ... more sections
  ],
  navigation: true|false,
  responsive_breakpoints: ["mobile", "tablet", "desktop"]
}
```

### 3. Code Agent

**Purpose:** Generate the actual HTML/CSS/JS code.

**Input:**
- Structure output
- Selected stack (react-tailwind, vue-tailwind, etc.)

**Output:**
```javascript
{
  stack: "react-tailwind",
  files: [
    { path: "index.html", content: "..." },
    { path: "App.jsx", content: "..." },
    { path: "styles.css", content: "..." }
  ],
  dependencies: ["react", "tailwindcss"],
  build_command: "npm run build"
}
```

### 4. Review Agent

**Purpose:** Quality check the generated code.

**Input:**
- Generated code files
- Original requirements

**Output:**
```javascript
{
  score: 85,
  issues: [
    { severity: "warning", message: "...", file: "App.jsx", line: 42 }
  ],
  suggestions: ["..."],
  passed: true|false
}
```

### 5. Preview Agent

**Purpose:** Prepare and serve the preview.

**Input:**
- Built/compiled code

**Output:**
```javascript
{
  preview_url: "http://localhost:3460/preview/abc123",
  screenshot_url: "http://localhost:3460/screenshots/abc123.png",
  expires_at: "ISO-8601"
}
```

### 6. Deploy Agent

**Purpose:** Handle deployment to GitHub Pages or ZIP.

**Input:**
- Final code
- Deployment target (github|zip)

**Output:**
```javascript
{
  deployed_url: "https://user.github.io/landing-pages/abc123",
  zip_download: "http://localhost:3460/download/abc123.zip",
  status: "success|failed"
}
```

---

## Chat Persistence

User and assistant messages are persisted in the `messages` table. The frontend restores the current `sessionId` from `localStorage` on load and fetches messages from `GET /sessions/:id/messages`. This makes the chat survive page reloads and browser restarts.

---

## Orchestrator Implementation

The orchestrator (`lp-orchestrator.cjs`) manages the agent pipeline:

```javascript
// Pseudocode
class Orchestrator {
  async run(sessionId, userInput) {
    const context = this.createContext(sessionId, userInput);
    
    try {
      // Phase 1: Intention
      const intention = await this.runAgent('intention', context);
      context.memory.intention = intention;
      
      // Phase 2: Structure
      const structure = await this.runAgent('structure', context);
      context.memory.structure = structure;
      
      // Phase 3: Code
      const code = await this.runAgent('code', context);
      context.memory.code = code;
      
      // Phase 4: Review
      const review = await this.runAgent('review', context);
      context.memory.review = review;
      
      // Phase 5: Preview
      const preview = await this.runAgent('preview', context);
      context.memory.preview = preview;
      
      // Phase 6: Deploy (optional)
      if (context.input.shouldDeploy) {
        const deploy = await this.runAgent('deploy', context);
        context.memory.deploy = deploy;
      }
      
      return context.memory;
    } catch (error) {
      await this.handleError(context, error);
      throw error;
    }
  }
}
```

---

## Bridge Adapter

The Bridge Adapter (`lpBridgeAdapter.cjs`) connects the orchestrator to the Kimi AI bridge:

```javascript
// Features:
// - Isolated user IDs per session
// - Automatic retry on failure
// - Event emission for SSE streaming
// - Rate limiting compliance
// - Context window management
```

---

## Workers

### Mining Worker

Background worker that:
1. Receives URLs for template mining
2. Scrapes and analyzes landing pages
3. Extracts reusable components and patterns
4. Stores mined templates in the database
5. Reports progress via the mining job queue

### Screenshot Worker

Background worker that:
1. Takes URLs or HTML content
2. Generates screenshots at multiple breakpoints
3. Stores screenshots for previews
4. Supports mobile, tablet, and desktop viewports

---

## Error Handling

### Agent Failure Recovery

```javascript
// Recovery strategies per failure type:
{
  "timeout": "retry_with_backoff",
  "rate_limit": "queue_and_retry",
  "context_overflow": "summarize_and_continue",
  "invalid_output": "retry_with_stricter_prompt",
  "unrecoverable": "fail_and_notify"
}
```

### Max Retries

- Per agent: 3 attempts
- Per phase: 2 attempts
- Full pipeline: 1 attempt (fails fast)

---

## Integration Points

| Component | Integrates With | Purpose |
|-----------|----------------|---------|
| Orchestrator | Bridge Adapter | AI communication |
| Orchestrator | Session Service | State persistence |
| Workers | Mining Service | Template extraction |
| Workers | Preview Service | Screenshot generation |
| Bug Detector | Rebuild Engine | Auto-fix pipeline |
| Token Service | All Services | Usage tracking |

---

## Configuration

Agent behavior can be configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `KIMI_CDP_URL` | Chrome DevTools Protocol URL | `http://127.0.0.1:9226` |
| `KIMI_CDP_PORT` | Isolated CDP port | `9226` |
| `KIMI_CHROME_USER_DATA_DIR` | Isolated Chrome profile (must differ from Luna dashboard) | `~/.luna/nexo-lp-chrome-profile` |
| `KIMI_MAX_PAGES` | Max concurrent Kimi pages | `1` |
| `KIMI_BRIDGE_REUSE_USER_ID` | Reuse the same Kimi tab | `false` |
| `KIMI_BRIDGE_FIXED_USER_ID` | Fixed userId when reuse is enabled | - |
| `REBUILD_MAX_ATTEMPTS` | Max fix iterations | 3 |
| `MINING_ENABLED` | Enable template mining | true |
| `MINING_QUEUE_SIZE` | Concurrent mining jobs | 10 |

---

## Visual Debugging

By default the Chrome instance used by the Kimi bridge is launched **visible** (not headless). If the window is minimized or behind other windows, the bridge will now automatically bring it to the foreground and maximize it whenever a page is created or reused.

### Manual controls

- Bring the current Kimi window to the front immediately:
  ```bash
  node scripts/bring-kimi-to-front.js
  ```
- Set the CDP URL if you run Chrome on a different port:
  ```bash
  KIMI_CDP_URL=http://127.0.0.1:9226 node scripts/bring-kimi-to-front.js
  ```
- Set the screenshot directory for debug scripts:
  ```bash
  NEXO_SCREENSHOT_DIR=/tmp/nexo-screenshots node scripts/debug-kimi-page.js
  ```

### Notes

- The bridge stores a per-user marker (`page._lunaUserId`) so it never closes tabs belonging to other users when enforcing the tab limit.
- The Chrome launcher starts Chrome with `--start-maximized --window-position=0,0` to keep the window visible on the primary display.
