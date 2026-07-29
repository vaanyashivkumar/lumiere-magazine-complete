/* Self-hosted analytics beacon for the Lumiere flipbook.
   Sends a page view + Core Web Vitals to /api/track (which only exists on the Vercel deploy;
   on GitHub Pages the requests simply 404 and are ignored). No cookies — a random id in
   localStorage is used only to estimate unique visitors. */
(() => {
  "use strict";

  // Stable-ish anonymous id (not a cookie, not shared cross-site) for unique-visitor counting.
  let cid;
  try {
    cid = localStorage.getItem("_lm_cid");
    if (!cid) {
      cid = (self.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem("_lm_cid", cid);
    }
  } catch (e) { cid = "anon"; }

  function send(payload) {
    try {
      const body = JSON.stringify(payload);
      // sendBeacon is best for unload-time vitals; fall back to keepalive fetch.
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }

  // 1) Page view
  send({ type: "view", ref: document.referrer || "", cid: cid, path: location.pathname });

  // 2) Core Web Vitals (the same metrics Vercel Speed Insights reports)
  const wv = self.webVitals;
  if (wv) {
    const report = (metric) => send({ type: "vital", name: metric.name, value: metric.value, cid: cid });
    (wv.onLCP || function () {})(report);
    (wv.onCLS || function () {})(report);
    (wv.onINP || function () {})(report);
    (wv.onFCP || function () {})(report);
    (wv.onTTFB || function () {})(report);
  }
})();
