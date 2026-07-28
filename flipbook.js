(() => {
  "use strict";

  const PAGE_COUNT = 92;
  const BREAKPOINT = 900; // <= this width => mobile swipe carousel; above => desktop 2-page flip

  const bookElement = document.querySelector("#book");
  const bookWrap = document.querySelector("#bookWrap");
  const progress = document.querySelector("#progress");
  const pageLabel = document.querySelector("#pageLabel");
  const hint = document.querySelector("#hint");
  const previousButtons = [document.querySelector("#previous"), document.querySelector("#footerPrevious")];
  const nextButtons = [document.querySelector("#next"), document.querySelector("#footerNext")];

  const images = Array.from({ length: PAGE_COUNT }, (_, i) =>
    `pages/page-${String(i + 1).padStart(3, "0")}.jpg`);

  let mode = null;      // "portrait" (carousel) | "landscape" (flip)
  let pageFlip = null;  // StPageFlip instance (landscape only)
  let current = 0;      // current page index (0-based)
  let zoom = 1;

  const clamp = i => Math.max(0, Math.min(PAGE_COUNT - 1, i));

  function labelFor(i) {
    if (i <= 0) return `Cover · Page 1 of ${PAGE_COUNT}`;
    if (i >= PAGE_COUNT - 1) return `Back cover · Page ${PAGE_COUNT} of ${PAGE_COUNT}`;
    if (mode === "landscape") {
      const left = i % 2 === 0 ? i : i + 1;
      return `Pages ${left}–${Math.min(left + 1, PAGE_COUNT)} of ${PAGE_COUNT}`;
    }
    return `Page ${i + 1} of ${PAGE_COUNT}`;
  }

  function reflectState(i) {
    current = clamp(i);
    if (progress) progress.value = current;
    if (pageLabel) pageLabel.textContent = labelFor(current);
    previousButtons.forEach(b => b && (b.disabled = current <= 0));
    nextButtons.forEach(b => b && (b.disabled = current >= PAGE_COUNT - 1));
    bookWrap.classList.toggle("at-front", current <= 0);
    bookWrap.classList.toggle("at-back", current >= PAGE_COUNT - 1);
  }

  function makePage(i) {
    const page = document.createElement("div");
    page.className = "magazine-page";
    page.dataset.density = i === 0 || i === PAGE_COUNT - 1 ? "hard" : "soft";
    const img = document.createElement("img");
    img.src = images[i];
    img.alt = `Lumiere magazine page ${i + 1}`;
    img.draggable = false;
    img.decoding = "async";
    img.loading = i < 4 ? "eager" : "lazy";
    page.append(img);
    return page;
  }

  // ---------------- MOBILE: native swipe carousel (no flip engine) ----------------
  let scrollTimer = null;
  function onCarouselScroll() {
    hint.classList.add("hidden");
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const w = bookElement.clientWidth || 1;
      reflectState(Math.round(bookElement.scrollLeft / w));
    }, 60);
  }
  function buildCarousel() {
    bookElement.innerHTML = "";
    for (let i = 0; i < PAGE_COUNT; i++) bookElement.append(makePage(i));
    bookElement.addEventListener("scroll", onCarouselScroll, { passive: true });
  }
  function carouselGo(i, smooth) {
    i = clamp(i);
    bookElement.scrollTo({ left: i * bookElement.clientWidth, behavior: smooth ? "smooth" : "auto" });
    reflectState(i);
  }

  // ---------------- DESKTOP: StPageFlip 2-page flip ----------------
  function buildFlip() {
    bookElement.innerHTML = "";
    const pages = [];
    for (let i = 0; i < PAGE_COUNT; i++) { const p = makePage(i); bookElement.append(p); pages.push(p); }
    pageFlip = new St.PageFlip(bookElement, {
      width: 595, height: 842, size: "stretch",
      minWidth: 280, maxWidth: 1190, minHeight: 396, maxHeight: 1684,
      showCover: true, usePortrait: false,
      drawShadow: true, maxShadowOpacity: 0.62, flippingTime: 1000,
      startZIndex: 10, autoSize: false, mobileScrollSupport: false,
      swipeDistance: 24, clickEventForward: true, showPageCorners: true, disableFlipByClick: false
    });
    pageFlip.loadFromHTML(pages);
    pageFlip.on("flip", () => { hint.classList.add("hidden"); reflectState(pageFlip.getCurrentPageIndex()); });
    pageFlip.on("changeState", e => {
      bookWrap.classList.toggle("is-flipping", e.data !== "read");
      if (e.data === "read") reflectState(pageFlip.getCurrentPageIndex());
    });
    const refit = () => { try { window.dispatchEvent(new Event("resize")); } catch (e) {} };
    requestAnimationFrame(refit);
    setTimeout(refit, 200);
  }

  // ---------------- unified controls ----------------
  const goNext = () => { if (mode === "portrait") carouselGo(current + 1, true); else if (pageFlip) pageFlip.flipNext("top"); };
  const goPrev = () => { if (mode === "portrait") carouselGo(current - 1, true); else if (pageFlip) pageFlip.flipPrev("top"); };
  const goFirst = () => { if (mode === "portrait") carouselGo(0, true); else if (pageFlip) pageFlip.turnToPage(0); };
  const goLast = () => { if (mode === "portrait") carouselGo(PAGE_COUNT - 1, true); else if (pageFlip) pageFlip.turnToPage(PAGE_COUNT - 1); };
  const goToPage = i => { if (mode === "portrait") carouselGo(i, true); else if (pageFlip) pageFlip.turnToPage(clamp(i)); };

  // ---------------- (re)build for the current viewport ----------------
  function build() {
    const portrait = window.innerWidth <= BREAKPOINT || !window.St?.PageFlip;
    const nextMode = portrait ? "portrait" : "landscape";
    if (mode === nextMode) {                 // same mode — just realign the carousel
      if (portrait) carouselGo(current, false);
      return;
    }
    if (pageFlip) { try { pageFlip.destroy(); } catch (e) {} pageFlip = null; }
    bookElement.removeEventListener("scroll", onCarouselScroll);
    bookElement.innerHTML = "";
    mode = nextMode;
    document.documentElement.setAttribute("data-flip", mode);
    void bookElement.offsetWidth; // flush layout before building/measuring

    if (portrait) {
      buildCarousel();
      carouselGo(current, false);
      hint.textContent = "Swipe to turn pages";
    } else {
      buildFlip();
      if (current > 0 && pageFlip) { try { pageFlip.turnToPage(current); } catch (e) {} }
      hint.textContent = "Drag a corner or use the arrow keys";
    }
    reflectState(current);
  }

  // ---------------- one-time UI wiring ----------------
  previousButtons.forEach(b => b && b.addEventListener("click", goPrev));
  nextButtons.forEach(b => b && b.addEventListener("click", goNext));
  document.querySelector("#first").addEventListener("click", goFirst);
  document.querySelector("#last").addEventListener("click", goLast);
  progress.max = PAGE_COUNT - 1;
  progress.addEventListener("change", e => goToPage(Number(e.target.value)));

  document.addEventListener("keydown", e => {
    if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); goNext(); }
    if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); goPrev(); }
    if (e.key === "Home") goFirst();
    if (e.key === "End") goLast();
  });

  function setZoom(v) {
    zoom = Math.max(.7, Math.min(1.6, v));
    document.documentElement.style.setProperty("--zoom", zoom);
    document.querySelector("#zoomValue").textContent = `${Math.round(zoom * 100)}%`;
  }
  document.querySelector("#zoomIn").addEventListener("click", () => setZoom(zoom + .1));
  document.querySelector("#zoomOut").addEventListener("click", () => setZoom(zoom - .1));

  const fsBtn = document.querySelector("#fullscreen");
  fsBtn.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (e) {}
  });
  document.addEventListener("fullscreenchange", () => { fsBtn.textContent = document.fullscreenElement ? "×" : "⛶"; });

  // ---------------- responsive ----------------
  let rz;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(build, 160); });
  window.addEventListener("orientationchange", () => setTimeout(build, 250));
  const mq = window.matchMedia(`(max-width: ${BREAKPOINT}px)`);
  if (mq.addEventListener) mq.addEventListener("change", build);
  else if (mq.addListener) mq.addListener(build);

  build();
})();
