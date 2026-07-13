# snip — AI agent conventions (Claude Code)

> **Keep in sync with `.github/copilot-instructions.md`** — both files carry the
> same rule set; if you change one, change the other in the same commit.

---

## What this repo is

A **Git superproject** (`main` branch) containing four submodules, each on its own
orphan branch.  The superproject stores only `README.md`, `.gitmodules`,
`scripts/build-bundle.mjs`, and these instruction files — **no source code**.

## Layout & tech stack

| Path | Branch | Runtime / tech | Role |
|------|--------|----------------|------|
| `backend/` | `backend` | Bun ≥ 1 (`Bun.serve`) | REST API + redirect server |
| `frontend/` | `frontend` | Angular 19, Node/npm | SPA — talks to port 3000 |
| `cli/` | `cli` | Node ≥ 18, CommonJS | Zero-dep CLI (`snip add/ls/open`) |
| `bundle/` | `bundle` | — | **GENERATED output — never hand-edit** |
| `scripts/` | `main` | Node/Bun ESM | `build-bundle.mjs` assembler |

Environment variable overrides: `PORT` (backend, default 3000), `BASE_URL`,
`SNIP_API` (CLI, default `http://localhost:3000`),
`PUBLIC_DIR` (backend static files; set in `bundle/.env`).

## API contract

**Change the API in all three layers (backend + frontend + cli) or not at all.**

| Method | Path | Request body | Success | Notes |
|--------|------|--------------|---------|-------|
| `POST` | `/api/links` | `{ "url": "…" }` | `201 { code, url, shortUrl, hits, createdAt }` | Creates short link |
| `GET` | `/api/links` | — | `200 [{ code, url, shortUrl, hits, createdAt }]` | Lists all links |
| `GET` | `/:code` | — | `302 Location: <url>` | Redirect; increments `hits` |

Errors always return `{ "error": "<message>" }` with an appropriate 4xx/5xx status.

## Key commands

```sh
# Clone (never omit --recurse-submodules — plain clone leaves submodule dirs empty)
git clone --recurse-submodules https://github.com/EvilGia81/TestAI.git snip

# Run backend (port 3000)
cd backend && bun server.js

# Run frontend dev server (port 4200)
cd frontend && npm install && npm start

# CLI
node cli/cli.js help
SNIP_API=http://localhost:3000 node cli/cli.js ls

# Assemble bundle (no push)
node scripts/build-bundle.mjs
# or with Bun when node is not in PATH:
bun scripts/build-bundle.mjs

# Assemble + push bundle branch and main
node scripts/build-bundle.mjs --push
```

## Edit → push → pointer-bump workflow

Every submodule is a full Git repo.  After editing a layer:

```sh
cd <layer>               # e.g. backend/
# ... make changes ...
git add .
git commit -m "feat: …"
git push                 # pushes to origin/<branch>

cd ..                    # back to superproject
git submodule update --remote <layer>   # advance pointer to new commit
git add <layer>
git commit -m "chore: bump <layer> submodule pointer"
git push
```

`build-bundle.mjs` handles the full pipeline automatically (including the
pointer-bump for `bundle`) when run with `--push`.

---

## DO / DON'T — non-obvious traps

### `bundle/` is generated output
**Never edit files inside `bundle/` by hand.**  Every file there is overwritten on
the next `build-bundle.mjs` run.  Make changes upstream (backend, frontend, or cli)
and rebuild.

### `cli.js` must stay CommonJS
`cli/package.json` deliberately has **no `"type":"module"`** field.  `bundle/package.json`
also has no `"type"` field for the same reason: `cli.js` uses `require()` and must
load as CommonJS even when co-located with `server.js` (ESM-compatible via Bun).
Do not add `"type":"module"` to either file.

### Angular output path is load-bearing
The build script copies `frontend/dist/snip-frontend/browser/` → `bundle/public/`.
Both path segments are derived from Angular config:
- **`snip-frontend`** is the Angular project name in `angular.json` (`projects` key).
- **`browser/`** is the Application builder's output subfolder (Angular ≥ 17).

If you rename the Angular project or change `outputPath`, update `DIST_INDEX` and
`DIST_DIR` in `scripts/build-bundle.mjs` to match.

### Storage is in-memory by design
`backend/server.js` uses a `Map` — links are lost on restart.  This is intentional
for the demo scope.  If you add persistence (SQLite, Redis, …), document it in the
README and update the API contract table if the response shape changes.

### Backend runtime is Bun, not Node
`server.js` uses `Bun.serve()` and `Bun.file()` — these are Bun-specific APIs and
will not run under plain Node.  Do not replace them with Node `http`/`fs` unless you
also remove all Bun-specific calls throughout.

### Bundle CI is schedule-triggered on purpose
Any CI workflow that runs `build-bundle.mjs --push` should be on a schedule (or
triggered manually / on submodule-branch pushes) — **not** on every push to `main`.
`main` changes are usually pointer bumps that don't require a full rebuild.

### Docker CI paths-filter watches the bundle GITLINK, not files
A `paths` filter for Docker CI should watch `bundle` (the 160000-mode gitlink entry
in the superproject tree), not `bundle/**`.  Submodule content changes are invisible
to the superproject's file tree; only the gitlink SHA changes.  Using `bundle/**`
will never fire.
