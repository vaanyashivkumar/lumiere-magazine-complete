// Ingest one tracking event into Upstash Redis via its REST API (no npm deps).
// Called by analytics.js on the magazine page. Runs only on Vercel.
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function pipeline(commands) {
  const r = await fetch(`${REST_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  return r.json();
}

const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

function deviceType(ua = "") {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return "Tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) return "Mobile";
  return "Desktop";
}
function browserName(ua = "") {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/(chrome|crios)\//i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) return "Safari";
  return "Other";
}
function refHost(ref) {
  if (!ref) return "Direct";
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    if (!h || /lumiere-magazine-complete\.vercel\.app$/i.test(h)) return "Direct";
    // bound referrer cardinality/garbage so the hash can't be flooded with junk hostnames
    if (h.length > 48 || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(h)) return "Other";
    return h;
  } catch { return "Direct"; }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();
  if (!REST_URL || !REST_TOKEN) return res.status(200).json({ ok: false, note: "store-not-configured" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body && typeof body === "object" ? body : {};

  const day = today();
  const cmds = [];

  if (body.type === "vital" && body.name && Number.isFinite(+body.value)) {
    const m = String(body.name).toUpperCase();
    if (["LCP", "CLS", "INP", "FCP", "TTFB"].includes(m)) {
      const val = Math.min(Math.max(0, +body.value), 600000); // clamp to sane range (anti-poisoning)
      const scaled = Math.round(val * 1000); // store ints (ms, or CLS*1000)
      cmds.push(["INCR", `vital:${m}:count`]);
      cmds.push(["INCRBY", `vital:${m}:sum`, scaled]);
      cmds.push(["LPUSH", `vital:${m}:samples`, scaled]);
      cmds.push(["LTRIM", `vital:${m}:samples`, 0, 499]); // keep last 500 for percentiles
      cmds.push(["EXPIRE", `vital:${m}:samples`, 60 * 60 * 24 * 90]);
    }
  } else {
    const ua = req.headers["user-agent"] || "";
    const country = String(req.headers["x-vercel-ip-country"] || "??").toUpperCase().slice(0, 2);
    const cid = String(body.cid || "anon").slice(0, 64);
    cmds.push(["INCR", "views:total"]);
    cmds.push(["INCR", `views:day:${day}`]);
    cmds.push(["EXPIRE", `views:day:${day}`, 60 * 60 * 24 * 400]);
    cmds.push(["PFADD", "visitors", cid]);
    cmds.push(["PFADD", `visitors:day:${day}`, cid]);
    cmds.push(["EXPIRE", `visitors:day:${day}`, 60 * 60 * 24 * 400]);
    cmds.push(["HINCRBY", "countries", country, 1]);
    cmds.push(["HINCRBY", "referrers", refHost(body.ref), 1]);
    cmds.push(["HINCRBY", "devices", deviceType(ua), 1]);
    cmds.push(["HINCRBY", "browsers", browserName(ua), 1]);
  }

  if (cmds.length) { try { await pipeline(cmds); } catch (e) { /* never fail a beacon */ } }
  res.status(204).end();
};
