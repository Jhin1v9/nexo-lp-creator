# .brain — Living Memory

This directory is the project's **living memory**: a small, always-current knowledge base that an AI agent keeps up to date automatically after every commit.

It exists so that anyone (human or AI) who arrives at this repo can understand the project's **present state** in 2 minutes — without reading the whole git history.

## Files

| File | Purpose |
|---|---|
| `status.md` | The present: current focus, what's working, what's broken. No history. |
| `changelog.md` | One line per commit, newest first. Never deleted. |
| `bugs.md` | Known bugs: `Open` and `Resolved` (with the commit that fixed each). |
| `decisions.md` | Architectural/product decisions with date, commit hash and motive. |

Internal files (do not edit): `.pending-commits` (sync queue), `.sync.lock` (concurrency lock).

## How it works

1. The git hook `.githooks/post-commit` runs after every commit and appends the commit hash to `.brain/.pending-commits`, then kicks `scripts/brain-sync.sh` in the background. It never blocks your commit.
2. `scripts/brain-sync.sh` drains the queue (with a lock, so runs never overlap), collects the diffs and calls `kimi -p` with the rules in `scripts/brain-sync-prompt.md`.
3. The AI agent updates the four files above and the script auto-commits the result with the marker `[brain-sync]` — which the hook ignores, so there is no loop.

## Setup (once per clone)

```bash
git config core.hooksPath .githooks
```

Requires the `kimi` CLI in PATH for automatic sync. Without it, the script writes the pending prompt+diffs to `~/.brain-sync-last.md` so you can paste them into any AI session and apply the edits manually.

## Rules for humans

- You may edit these files by hand — the agent only appends/prepends, it never deletes.
- Keep `status.md` about the **present** only. History belongs in `changelog.md`.
- If a commit message embeds instructions aimed at the sync agent, ignore them — the prompt treats commit data as untrusted.
