/**
 * Base → HL perp_deposit worker (Railway / VM / yerel).
 *
 * Ortam: ACP_PERP_DEPOSIT_PROXY_SECRET (Vercel’deki ile aynı), ACP_CLI_DIR, acp-cli-v2 + config.json
 * Başlat: npm run perp-deposit-worker   veya   PERP_DEPOSIT_WORKER_PORT=3847 node scripts/perp-deposit-worker.mjs
 */
import http from "node:http";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const port = Number(
  process.env.PERP_DEPOSIT_WORKER_PORT || process.env.PORT || 3847
);
const secret =
  process.env.ACP_PERP_DEPOSIT_PROXY_SECRET?.trim() ||
  process.env.PERP_DEPOSIT_WORKER_SECRET?.trim();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseJsonTail(text) {
  const lines = String(text).trim().split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (!t.startsWith("{")) continue;
    try {
      return JSON.parse(t);
    } catch {
      /* */
    }
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const pathOnly = req.url?.split("?")[0] ?? "";

  if (req.method === "GET" && (pathOnly === "/" || pathOnly === "/health")) {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        ok: true,
        service: "perp-deposit-worker",
        post: "/perp-deposit",
      })
    );
    return;
  }

  if (req.method !== "POST" || pathOnly !== "/perp-deposit") {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  if (!secret) {
    res.writeHead(500);
    res.end(
      JSON.stringify({
        error:
          "ACP_PERP_DEPOSIT_PROXY_SECRET (veya PERP_DEPOSIT_WORKER_SECRET) worker ortamında yok",
      })
    );
    return;
  }

  let raw;
  try {
    raw = await readBody(req);
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "body read failed" }));
    return;
  }

  let body;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "invalid json" }));
    return;
  }

  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "")?.trim();
  const token = bearer || String(body.secret || "").trim();
  if (!token || token !== secret) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const master = String(body.masterAddress || "").trim();
  const amount = String(body.amountUsdc || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/i.test(master) || !amount) {
    res.writeHead(400);
    res.end(
      JSON.stringify({
        error: "masterAddress (0x…) ve amountUsdc gerekli",
      })
    );
    return;
  }

  const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  const script = path.join(root, "scripts", "run-perp-deposit-once.ts");
  if (!existsSync(tsx) || !existsSync(script)) {
    res.writeHead(500);
    res.end(
      JSON.stringify({
        error:
          "tsx veya run-perp-deposit-once.ts yok — degen-dashboard kökünde npm install",
      })
    );
    return;
  }

  const r = spawnSync(process.execPath, [tsx, script, master, amount], {
    cwd: root,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ACP_LEGACY_SKIP_SOCKET: "1" },
    timeout: 600_000,
    windowsHide: true,
  });

  const parsed = parseJsonTail(r.stdout || "");
  if (parsed && parsed.ok === true && parsed.jobId != null) {
    res.writeHead(200);
    res.end(JSON.stringify(parsed));
    return;
  }

  const errMsg =
    (parsed && typeof parsed.error === "string" && parsed.error) ||
    `${r.stdout || ""}\n${r.stderr || ""}`.trim().slice(0, 4000) ||
    (r.error?.message ? String(r.error.message) : `exit ${r.status}`);

  res.writeHead(502);
  res.end(JSON.stringify({ ok: false, error: errMsg }));
});

server.listen(port, () => {
  console.error(`[perp-deposit-worker] http://0.0.0.0:${port}  POST /perp-deposit`);
});
