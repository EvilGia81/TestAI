# Snip — Backend

A tiny URL shortener API built with [Bun](https://bun.sh), zero npm dependencies.

## Start

```sh
bun run server.js
# or via package.json
bun start
```

## Environment variables

| Variable               | Default      | Description                                                                 |
|------------------------|--------------|-----------------------------------------------------------------------------|
| `PORT`                 | `3000`       | Port to listen on                                                           |
| `BASE_URL`             | auto         | Origin used in `shortUrl`; falls back to `RAILWAY_PUBLIC_DOMAIN` or `localhost` |
| `PUBLIC_DIR`           | —            | Path to a folder of static files; `/` → `index.html`; a matching file wins over a short code |

## API

| Method | Path         | Body / Response                                                   |
|--------|--------------|-------------------------------------------------------------------|
| `POST` | `/api/links` | `{ "url": "https://…" }` → `201 { code, url, shortUrl, hits, createdAt }` |
| `GET`  | `/api/links` | `200` array of all links (same shape)                             |
| `GET`  | `/:code`     | `302` redirect; increments `hits`; `404` if unknown              |

Returns `400` on invalid JSON or a non-http(s) URL.
All responses include open CORS headers.
