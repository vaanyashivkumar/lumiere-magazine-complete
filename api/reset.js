// Admin-only: wipe all analytics data from the dedicated Upstash Redis DB.
// Requires POST + the correct secret in the x-admin-key header (same key as /api/stats).
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_KEY = process.env.ADMIN_KEY || "";

function safeEqual(a, b) {
  a = String(a); b = String(b);
  let out = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) out |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return out === 0;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const key = req.headers["x-admin-key"] || "";
  if (!ADMIN_KEY || !safeEqual(key, ADMIN_KEY)) return res.status(401).json({ error: "unauthorized" });
  if (req.method !== "POST") return res.status(405).json({ error: "use POST to reset" });
  if (!REST_URL || !REST_TOKEN) return res.status(200).json({ ok: false, note: "store-not-configured" });
  try {
    const r = await fetch(`${REST_URL}/flushdb`, { method: "POST", headers: { Authorization: `Bearer ${REST_TOKEN}` } });
    const j = await r.json();
    return res.status(200).json({ ok: true, flushed: j.result === "OK" || j.result === true });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e) });
  }
};
