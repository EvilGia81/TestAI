#!/usr/bin/env node
/**
 * scripts/build-bundle.mjs
 *
 * Assembles the snip "bundle" submodule from the backend, frontend, and cli
 * submodules, then commits the result and (optionally) pushes.
 *
 * Usage:
 *   node scripts/build-bundle.mjs          # assemble only
 *   node scripts/build-bundle.mjs --push   # assemble + push
 *
 * Zero external dependencies — only Node built-ins.
 * Works on Windows, macOS, Linux, and in CI.
 */

import { spawnSync }                                         from 'child_process';
import { cpSync, copyFileSync, existsSync, mkdirSync,
         rmSync, writeFileSync }                             from 'fs';
import { join, resolve }                                     from 'path';
import { fileURLToPath }                                     from 'url';

// ── paths ────────────────────────────────────────────────────────────────────

const ROOT     = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BACKEND  = join(ROOT, 'backend');
const FRONTEND = join(ROOT, 'frontend');
const CLI_DIR  = join(ROOT, 'cli');
const BUNDLE   = join(ROOT, 'bundle');

const PUSH = process.argv.includes('--push');

// ── helpers ──────────────────────────────────────────────────────────────────

const C = { reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m',
            green: '\x1b[32m', cyan: '\x1b[36m' };

function step(label) {
  console.log(`\n${C.bold}${C.cyan}▶ ${label}${C.reset}`);
}

function ok(msg) {
  console.log(`  ${C.green}✔${C.reset} ${msg}`);
}

function fail(msg) {
  console.error(`${C.red}✖ FATAL:${C.reset} ${msg}`);
  process.exit(1);
}

/**
 * Run a command, streaming its output.
 * shell:true lets Windows resolve .cmd/.exe shims (needed for npm, bun).
 * Git is a real binary — always call gitRun() for it so args aren't re-split
 * by cmd.exe when the message contains spaces/colons.
 */
function run(cmd, args, cwd = ROOT) {
  const display = [cmd, ...args].join(' ');
  console.log(`  $ ${display}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  if (r.error) fail(`Spawn error for "${display}": ${r.error.message}`);
  if (r.status !== 0) fail(`Exit ${r.status}: ${display}`);
}

/** Run git directly (shell:false so commit messages with spaces/colons are safe). */
function gitRun(args, cwd = ROOT) {
  const display = ['git', ...args].join(' ');
  console.log(`  $ ${display}`);
  const r = spawnSync('git', args, { cwd, stdio: 'inherit', shell: false });
  if (r.error) fail(`Spawn error for "${display}": ${r.error.message}`);
  if (r.status !== 0) fail(`Exit ${r.status}: ${display}`);
}

/** Run a command and capture its stdout/stderr. */
function capture(cmd, args, cwd = ROOT) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: true });
  return {
    ok:     r.status === 0,
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? '').trim(),
  };
}

/** Returns true when the index has staged changes. */
function hasStagedChanges(cwd) {
  // exit 1 means differences exist; shell:false so git gets exact args
  return spawnSync('git', ['diff', '--cached', '--quiet'], { cwd, shell: false }).status !== 0;
}

// ── 1. Update backend / frontend / cli submodules ───────────────────────────

step('Updating backend / frontend / cli to their branch tips');
gitRun(['submodule', 'update', '--init', '--remote', 'backend', 'frontend', 'cli']);
ok('All three submodules up-to-date');

// ── 2. Build the frontend ────────────────────────────────────────────────────

step('Installing frontend dependencies');

// Prefer npm; fall back to bun (which ships an npm-compatible installer)
const pmInstall = capture('npm', ['--version']).ok ? 'npm' : 'bun';
if (!capture(pmInstall, ['--version']).ok) {
  fail('Neither npm nor bun found in PATH — install one before running this script');
}
ok(`Package manager: ${pmInstall}`);

// Skip install when the ng binary is already present (e.g. node_modules cached
// in CI or already installed on the dev machine).  Run install only when the
// binary is absent so the step is a fast no-op on repeat runs.
const ngBinPresent = ['ng', 'ng.exe', 'ng.cmd', 'ng.bunx']
  .some(b => existsSync(join(FRONTEND, 'node_modules', '.bin', b)));
if (ngBinPresent) {
  ok('node_modules already installed — skipping install');
} else {
  run(pmInstall, ['install'], FRONTEND);
}

step('Building Angular frontend');
// Invoke the "build" script from frontend/package.json — avoids hard-coding
// the path to the ng binary, which differs between npm and bun installs.
// On systems without npm, fall back to the local ng binary directly.
const ngBinPath = ['ng', 'ng.exe', 'ng.cmd', 'ng.bunx']
  .map(b => join(FRONTEND, 'node_modules', '.bin', b))
  .find(p => existsSync(p));
if (!ngBinPath) fail('Angular CLI binary not found in frontend/node_modules/.bin');

run(ngBinPath, ['build'], FRONTEND);

const DIST_INDEX = join(FRONTEND, 'dist', 'snip-frontend', 'browser', 'index.html');
if (!existsSync(DIST_INDEX)) {
  fail(`Build finished but expected output is missing:\n  ${DIST_INDEX}`);
}
ok(`Angular build verified — ${DIST_INDEX}`);

// ── 3. Assemble bundle/ ──────────────────────────────────────────────────────

step('Assembling bundle/');

// Remove previously generated files so stale artefacts never linger.
// We leave .git/ alone — that belongs to the submodule checkout.
for (const name of [
  'server.js', 'cli.js', 'public',
  '.env', 'package.json',
  'Dockerfile', '.dockerignore', 'railway.json',
]) {
  const p = join(BUNDLE, name);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

// server.js — copied verbatim from backend
copyFileSync(join(BACKEND, 'server.js'), join(BUNDLE, 'server.js'));
ok('server.js  ← backend/server.js');

// cli.js — copied verbatim from cli
copyFileSync(join(CLI_DIR, 'cli.js'), join(BUNDLE, 'cli.js'));
ok('cli.js     ← cli/cli.js');

// public/ ← Angular production build output
const DIST_DIR = join(FRONTEND, 'dist', 'snip-frontend', 'browser');
mkdirSync(join(BUNDLE, 'public'), { recursive: true });
cpSync(DIST_DIR, join(BUNDLE, 'public'), { recursive: true });
ok('public/    ← frontend/dist/snip-frontend/browser/');

// .env — Bun reads this automatically; tells server.js where static files live
writeFileSync(join(BUNDLE, '.env'), 'PUBLIC_DIR=./public\n', 'utf8');
ok('.env       — PUBLIC_DIR=./public');

// package.json — deliberately NO "type" field so cli.js loads as CommonJS
writeFileSync(
  join(BUNDLE, 'package.json'),
  JSON.stringify(
    {
      name: 'snip-bundle',
      version: '1.0.0',
      description: 'Snip URL shortener — self-contained bundle (generated output, do not hand-edit)',
      scripts: { start: 'bun server.js' },
      engines: { bun: '>=1.0.0' },
    },
    null,
    2,
  ) + '\n',
  'utf8',
);
ok('package.json — "start": "bun server.js", no "type" field');

// Dockerfile
writeFileSync(
  join(BUNDLE, 'Dockerfile'),
  [
    'FROM oven/bun:1-alpine',
    'WORKDIR /app',
    'COPY . .',
    'ENV PORT=3000',
    'EXPOSE 3000',
    'CMD bun server.js',
    '',
  ].join('\n'),
  'utf8',
);
ok('Dockerfile');

// .dockerignore
writeFileSync(
  join(BUNDLE, '.dockerignore'),
  ['.git', '*.md', ''].join('\n'),
  'utf8',
);
ok('.dockerignore');

// railway.json — select the Dockerfile builder
writeFileSync(
  join(BUNDLE, 'railway.json'),
  JSON.stringify({ build: { builder: 'DOCKERFILE' } }, null, 2) + '\n',
  'utf8',
);
ok('railway.json');

// ── 4. Commit inside bundle/ ─────────────────────────────────────────────────

step('Committing inside bundle/');

gitRun(['add', '-A'], BUNDLE);

if (hasStagedChanges(BUNDLE)) {
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  gitRun(['commit', '-m', `build: assemble bundle ${ts}`], BUNDLE);
  ok('Committed bundle/');
} else {
  ok('Nothing changed in bundle/ — skipping commit (safe no-op)');
}

// ── 5. Bump the bundle pointer in the superproject ───────────────────────────

step('Bumping superproject submodule pointer');

gitRun(['add', 'bundle'], ROOT);

if (hasStagedChanges(ROOT)) {
  gitRun(['commit', '-m', 'chore: bump bundle submodule pointer'], ROOT);
  ok('Superproject pointer bumped');
} else {
  ok('Superproject pointer already current — skipping commit (safe no-op)');
}

// ── 6. Push when requested ───────────────────────────────────────────────────

if (PUSH) {
  step('Pushing');

  // The bundle submodule checkout is in detached HEAD state — push explicitly
  // to the remote bundle branch.
  gitRun(['push', 'origin', 'HEAD:bundle'], BUNDLE);
  ok('bundle branch pushed → origin/bundle');

  gitRun(['push', 'origin', 'main'], ROOT);
  ok('main branch pushed  → origin/main');
} else {
  console.log(`\n  ${C.cyan}ℹ${C.reset}  Run with --push to push both branches to origin.`);
}

console.log(`\n${C.bold}${C.green}✔ build-bundle complete.${C.reset}\n`);
