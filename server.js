const PORT = parseInt(process.env.PORT ?? "3000", 10);
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function getBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `http://localhost:${PORT}`;
}

/** @type {Map<string, {code:string, url:string, shortUrl:string, hits:number, createdAt:string}>} */
const links = new Map();

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => BASE62[b % 62]).join("");
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function tryStatic(pathname) {
  const dir = process.env.PUBLIC_DIR;
  if (!dir) return null;
  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = Bun.file(`${dir}/${rel}`);
  return (await file.exists()) ? file : null;
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const method = req.method;

    // OPTIONS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // POST /api/links
    if (method === "POST" && pathname === "/api/links") {
      let body;
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      const { url } = body ?? {};
      if (!url || typeof url !== "string") {
        return json({ error: "url is required" }, 400);
      }
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return json({ error: "Invalid URL" }, 400);
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return json({ error: "URL must use http or https" }, 400);
      }
      let code;
      do {
        code = generateCode();
      } while (links.has(code));
      const entry = {
        code,
        url,
        shortUrl: `${getBaseUrl()}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, entry);
      return json(entry, 201);
    }

    // GET /api/links
    if (method === "GET" && pathname === "/api/links") {
      return json([...links.values()]);
    }

    // Static files win over short codes
    if (method === "GET") {
      const file = await tryStatic(pathname);
      if (file) {
        return new Response(file, { headers: CORS });
      }
    }

    // GET /:code → redirect
    if (method === "GET" && pathname.length > 1) {
      const code = pathname.slice(1);
      const entry = links.get(code);
      if (!entry) return json({ error: "Not found" }, 404);
      entry.hits++;
      return new Response(null, {
        status: 302,
        headers: { Location: entry.url, ...CORS },
      });
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`Snip listening on port ${PORT}`);
