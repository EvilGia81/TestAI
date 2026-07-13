# snip CLI

Zero-dependency Node.js CLI for the **snip** URL shortener.

## Requirements

- Node.js ≥ 18 (uses global `fetch`)
- A running snip backend (default: `http://localhost:3000`)

## Installation

```sh
npm install -g .
# or link locally
npm link
```

Set `SNIP_API` to point at a non-default backend:

```sh
export SNIP_API=https://snip.example.com
```

## Commands

| Command | Description |
|---|---|
| `snip add <url>` | Shorten a URL and print the short link |
| `snip ls` | List all shortened links in a table |
| `snip open <code>` | Open a short code in the OS default browser |
| `snip help` | Show usage text |

## Examples

```sh
$ snip add https://example.com/very/long/path
http://localhost:3000/abc123

$ snip ls
CODE    HITS  URL
------  ----  --------------------------
abc123     3  https://example.com/very/long/path

$ snip open abc123
Opening https://example.com/very/long/path
```

## Wrappers

- `snip` — POSIX shell wrapper
- `snip.cmd` — Windows CMD wrapper
- `snip.ps1` — PowerShell wrapper

All three simply forward arguments to `cli.js` via Node.
