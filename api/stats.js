// Return aggregated stats as JSON — but ONLY if the caller supplies the correct secret key.
// The secret lives server-side in the ADMIN_KEY env var and is never sent to the browser.
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_KEY = process.env.ADMIN_KEY || "";

async function pipeline(commands) {
  const r = await fetch(`${REST_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  return r.json();
}

// constant-time-ish compare so we don't leak the key length/prefix via timing
function safeEqual(a, b) {
  a = String(a); b = String(b);
  let out = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) out |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return out === 0;
}
function hashToObj(arr) {
  const o = {};
  if (Array.isArray(arr)) for (let i = 0; i < arr.length; i += 2) o[arr[i]] = Number(arr[i + 1]) || 0;
  return o;
}
function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const key = req.headers["x-admin-key"] || (req.query && req.query.key) || "";
  if (!ADMIN_KEY || !safeEqual(key, ADMIN_KEY)) {
    return res.status(401).json({ error: "unauthorized", hint: "append ?key=YOUR_SECRET to the URL" });
  }
  if (!REST_URL || !REST_TOKEN) {
    return res.status(200).json({ configured: false, note: "Connect an Upstash Redis store in Vercel to start collecting." });
  }

  // last 14 days (UTC)
  const days = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setUTCDate(now.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const metrics = ["LCP", "CLS", "INP", "FCP", "TTFB"];

  const cmds = [
    ["GET", "views:total"],
    ["PFCOUNT", "visitors"],
    ["HGETALL", "countries"],
    ["HGETALL", "referrers"],
    ["HGETALL", "devices"],
    ["HGETALL", "browsers"],
    ...days.map((d) => ["GET", `views:day:${d}`]),
    ...days.map((d) => ["PFCOUNT", `visitors:day:${d}`]),
    ...metrics.flatMap((m) => [
      ["GET", `vital:${m}:count`],
      ["GET", `vital:${m}:sum`],
      ["LRANGE", `vital:${m}:samples`, 0, 499],
    ]),
  ];

  let out;
  try { out = (await pipeline(cmds)).map((x) => x.result); }
  catch (e) { return res.status(200).json({ configured: true, error: "store-unreachable" }); }

  let i = 0;
  const totalViews = Number(out[i++] || 0);
  const uniqueVisitors = Number(out[i++] || 0);
  const countries = hashToObj(out[i++]);
  const referrers = hashToObj(out[i++]);
  const devices = hashToObj(out[i++]);
  const browsers = hashToObj(out[i++]);
  const dayViews = days.map((d, k) => ({ day: d, views: Number(out[i + k] || 0) }));
  i += days.length;
  const dayVisitors = days.map((d, k) => Number(out[i + k] || 0));
  i += days.length;
  const daily = dayViews.map((row, k) => ({ ...row, visitors: dayVisitors[k] }));

  const vitals = {};
  for (const m of metrics) {
    const count = Number(out[i++] || 0);
    const sum = Number(out[i++] || 0);
    const samples = (Array.isArray(out[i++]) ? out[i - 1] : []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const div = m === "CLS" ? 1000 : 1000; // stored scaled by 1000 for all
    vitals[m] = {
      count,
      avg: count ? sum / 1000 / count : null,
      p75: samples.length ? percentile(samples, 75) / 1000 : null,
      unit: m === "CLS" ? "" : "ms",
    };
  }

  res.status(200).json({
    configured: true,
    totalViews,
    uniqueVisitors,
    daily,
    countries,
    referrers,
    devices,
    browsers,
    vitals,
    generatedAt: Date.now(),
  });
};
