#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');

const BASE = (process.env.SNIP_API || 'http://localhost:3000').replace(/\/$/, '');

function die(msg) {
  process.stderr.write(msg + '\n');
  process.exit(1);
}

function usage() {
  process.stdout.write(
    'Usage:\n' +
    '  snip add <url>    Shorten a URL and print the short link\n' +
    '  snip ls           List all shortened links\n' +
    '  snip open <code>  Open a short code in the OS browser\n' +
    '  snip help         Show this help text\n'
  );
}

async function cmdAdd(url) {
  if (!url) die('Usage: snip add <url>');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    die('Invalid URL: ' + url);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    die('URL must start with http:// or https://');
  }

  let res;
  try {
    res = await fetch(BASE + '/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch (err) {
    die('Cannot reach backend at ' + BASE + ': ' + err.message);
  }

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    die('Server error ' + res.status + (body ? ': ' + body : ''));
  }

  let data;
  try { data = await res.json(); } catch {
    die('Unexpected response from server');
  }

  if (!data.shortUrl) die('Server returned no shortUrl');
  process.stdout.write(data.shortUrl + '\n');
}

async function cmdLs() {
  let res;
  try {
    res = await fetch(BASE + '/api/links');
  } catch (err) {
    die('Cannot reach backend at ' + BASE + ': ' + err.message);
  }

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    die('Server error ' + res.status + (body ? ': ' + body : ''));
  }

  let links;
  try { links = await res.json(); } catch {
    die('Unexpected response from server');
  }

  if (!Array.isArray(links) || links.length === 0) {
    process.stdout.write('No links yet.\n');
    return;
  }

  // Compute column widths
  const codeW = Math.max(4, ...links.map(l => String(l.code || '').length));
  const hitsW = Math.max(4, ...links.map(l => String(l.hits ?? 0).length));
  const urlW  = Math.max(3,  ...links.map(l => String(l.url  || '').length));

  const sep = '-'.repeat(codeW) + '  ' + '-'.repeat(hitsW) + '  ' + '-'.repeat(urlW);
  const header =
    'CODE'.padEnd(codeW) + '  ' +
    'HITS'.padStart(hitsW) + '  ' +
    'URL';

  process.stdout.write(header + '\n');
  process.stdout.write(sep   + '\n');
  for (const l of links) {
    const code = String(l.code || '').padEnd(codeW);
    const hits = String(l.hits ?? 0).padStart(hitsW);
    const url  = String(l.url  || '');
    process.stdout.write(code + '  ' + hits + '  ' + url + '\n');
  }
}

async function cmdOpen(code) {
  if (!code) die('Usage: snip open <code>');

  // Validate code: alphanumeric only
  if (!/^[A-Za-z0-9_-]+$/.test(code)) die('Invalid code: ' + code);

  let res;
  try {
    res = await fetch(BASE + '/' + encodeURIComponent(code), { redirect: 'manual' });
  } catch (err) {
    die('Cannot reach backend at ' + BASE + ': ' + err.message);
  }

  // Expect a 3xx redirect
  if (res.status < 300 || res.status >= 400) {
    if (res.status === 404) die('Unknown short code: ' + code);
    die('Unexpected status ' + res.status + ' for code: ' + code);
  }

  const location = res.headers.get('location');
  if (!location) die('Server returned a redirect with no Location header');

  // Validate the location URL before opening
  let target;
  try {
    target = new URL(location);
  } catch {
    die('Server returned an invalid redirect URL: ' + location);
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    die('Refusing to open non-HTTP URL: ' + location);
  }

  process.stdout.write('Opening ' + location + '\n');

  const platform = process.platform;
  let opener;
  if (platform === 'win32')  opener = 'start ""';
  else if (platform === 'darwin') opener = 'open';
  else opener = 'xdg-open';

  try {
    execSync(opener + ' ' + JSON.stringify(location), { stdio: 'ignore' });
  } catch (err) {
    die('Failed to open browser: ' + err.message);
  }
}

async function main() {
  const [,, cmd, ...rest] = process.argv;

  switch (cmd) {
    case 'add':
      await cmdAdd(rest[0]);
      break;
    case 'ls':
      await cmdLs();
      break;
    case 'open':
      await cmdOpen(rest[0]);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      usage();
      break;
    default:
      process.stderr.write("Unknown command: " + cmd + "\n\n");
      usage();
      process.exit(1);
  }
}

main().catch(err => die('Unexpected error: ' + err.message));
