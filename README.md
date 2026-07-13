# snip — URL Shortener Monorepo

One backend, two clients.  
Each layer lives on its own Git branch and is mounted here as a submodule so you get a single clone that contains everything.

```
snip/
├── backend/    ← branch: backend   (Node/Express REST API + SQLite)
├── frontend/   ← branch: frontend  (Angular 19 SPA)
└── cli/        ← branch: cli       (zero-dep Node CLI, CommonJS)
```

---

## API Contract

The backend exposes two routes; both clients speak only these:

| Method | Path          | Request body      | Success response                          | Description                  |
|--------|---------------|-------------------|-------------------------------------------|------------------------------|
| POST   | `/api/links`  | `{ "url": "…" }`  | `201` `{ code, url, shortUrl, hits, createdAt }` | Shorten a URL          |
| GET    | `/api/links`  | —                 | `200` `[ { code, url, shortUrl, hits, createdAt }, … ]` | List all links  |
| GET    | `/:code`      | —                 | `302 Location: <original-url>`            | Redirect to original URL     |

Error responses are `{ "error": "<message>" }` with an appropriate 4xx/5xx status.

---

## Branch-per-layer + submodule layout

| Branch     | Contents                                   |
|------------|--------------------------------------------|
| `main`     | This README + `.gitmodules` only (superproject) |
| `backend`  | `server.js`, `package.json`, `db/`         |
| `frontend` | Angular workspace (`src/`, `angular.json`, …) |
| `cli`      | `cli.js`, `package.json`, shell wrappers   |

Each submodule folder is a normal Git repo whose `HEAD` tracks its designated branch.  
The superproject stores a **commit pointer** (SHA) for each submodule — it does not track branch names at runtime, only the specific commit that was last pinned.

---

## Cloning

> **Always clone with `--recurse-submodules`.**  
> A plain `git clone` leaves `backend/`, `frontend/`, and `cli/` as empty directories.

```sh
git clone --recurse-submodules https://github.com/EvilGia81/TestAI.git snip
cd snip
```

If you already cloned without the flag:

```sh
git submodule update --init --recursive
```

---

## Running all three pieces

### 1 — Backend (Node 18+, port 3000)

```sh
cd backend
npm install
npm start          # or: node server.js
```

### 2 — Frontend (Angular dev server, port 4200)

```sh
cd frontend
npm install
npm start          # ng serve — proxies /api to localhost:3000
```

### 3 — CLI (Node 18+)

```sh
cd cli
npm install -g .   # adds `snip` to PATH
# or without installing:
node cli/cli.js help
```

Set `SNIP_API` if the backend is not on `http://localhost:3000`:

```sh
export SNIP_API=https://snip.example.com
snip add https://example.com/very/long/path
snip ls
snip open <code>
```

---

## Update workflow

### Pushing a change inside a submodule

```sh
# 1. work inside the submodule
cd backend
# ... edit files ...
git add .
git commit -m "fix: improve redirect logic"
git push                     # pushes to origin/backend

cd ..                        # back to superproject
```

### Bumping the superproject pointer

After pushing in the submodule, the superproject still points at the old commit.  
Advance the pointer with:

```sh
# Pull the latest commit from the submodule's tracked branch
git submodule update --remote backend

# Stage the updated pointer
git add backend

# Commit the bump
git commit -m "chore: bump backend submodule pointer"
git push
```

To update all submodules at once:

```sh
git submodule update --remote
git add backend frontend cli
git commit -m "chore: bump all submodule pointers"
git push
```

### Pulling updates as a consumer

```sh
git pull
git submodule update --recursive   # checks out the newly pinned SHAs
```
