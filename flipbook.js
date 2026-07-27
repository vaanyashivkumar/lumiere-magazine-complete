(() => {
  "use strict";

  const PAGE_COUNT = 92;
  const BREAKPOINT = 900; // <= this viewport width => single-page (mobile) mode

  const bookElement = document.querySelector("#book");
  const bookWrap = document.querySelector("#bookWrap");
  const progress = document.querySelector("#progress");
  const pageLabel = document.querySelector("#pageLabel");
  const hint = document.querySelector("#hint");
  const previousButtons = [document.querySelector("#previous"), document.querySelector("#footerPrevious")];
  const nextButtons = [document.querySelector("#next"), document.querySelector("#footerNext")];

  const images = Array.from({ length: PAGE_COUNT }, (_, i) =>
    `pages/page-${String(i + 1).padStart(3, "0")}.jpg`);

  let pageFlip = null;
  let mode = null;   // "portrait" (single page) | "landscape" (spread)
  let zoom = 1;

  if (!window.St?.PageFlip) {
    bookElement.innerHTML = '<p style="padding:2rem;color:#fff">The page-turn engine could not be loaded.</p>';
    return;
  }

  const wantsPortrait = () => window.innerWidth <= BREAKPOINT;

  function buildPages() {
    bookElement.innerHTML = "";
    return images.map((src, index) => {
      const page = document.createElement("div");
      page.className = "magazine-page";
      page.dataset.density = index === 0 || index === PAGE_COUNT - 1 ? "hard" : "soft";
      const img = document.createElement("img");
      img.src = src;
      img.alt = `Lumiere magazine page ${index + 1}`;
      img.draggable = false;
      img.decoding = "async";
      img.loading = index < 6 ? "eager" : "lazy";
      page.append(img);
      bookElement.append(page);
      return page;
    });
  }

  function pageText(index) {
    if (index <= 0) return `Cover · Page 1 of ${PAGE_COUNT}`;
    if (index >= PAGE_COUNT - 1) return `Back cover · Page ${PAGE_COUNT} of ${PAGE_COUNT}`;
    if (mode === "portrait") return `Page ${index + 1} of ${PAGE_COUNT}`;
    const left = index % 2 === 0 ? index : index + 1;
    return `Pages ${left}–${Math.min(left + 1, PAGE_COUNT)} of ${PAGE_COUNT}`;
  }

  function updateControls(index) {
    if (!pageFlip) return;
    if (index === undefined || index === null) index = pageFlip.getCurrentPageIndex();
    progress.value = index;
    pageLabel.textContent = pageText(index);
    previousButtons.forEach(b => { b.disabled = index <= 0; });
    nextButtons.forEach(b => { b.disabled = index >= PAGE_COUNT - 1; });
    bookWrap.classList.toggle("at-front", index <= 0);
    bookWrap.classList.toggle("at-back", index >= PAGE_COUNT - 1);
  }

  // (Re)build the flip engine. Only rebuilds when crossing the mobile/desktop breakpoint.
  function initFlip() {
    const portrait = wantsPortrait();
    const nextMode = portrait ? "portrait" : "landscape";
    let start = 0;
    if (pageFlip) {
      if (nextMode === mode) return;
      start = pageFlip.getCurrentPageIndex();
      try { pageFlip.destroy(); } catch (e) {}
      pageFlip = null;
    }
    mode = nextMode;
    document.documentElement.setAttribute("data-flip", mode); // keep CSS container in sync
    void bookElement.offsetWidth; // flush layout so the engine measures the NEW container size

    const pages = buildPages();
    pageFlip = new St.PageFlip(bookElement, {
      width: 595,
      height: 842,
      size: "stretch",
      minWidth: 280,
      maxWidth: 1400,
      minHeight: 396,
      maxHeight: 1980,
      showCover: true,
      usePortrait: portrait,       // true => single page on phones
      drawShadow: true,
      maxShadowOpacity: 0.6,
      flippingTime: 850,
      startZIndex: 10,
      autoSize: false,
      mobileScrollSupport: false,
      swipeDistance: 20,
      clickEventForward: true,
      showPageCorners: !portrait,
      disableFlipByClick: false
    });
    pageFlip.loadFromHTML(pages);

    // The engine occasionally renders before the container/images have their final size.
    // Nudge it to recompute (stretch mode re-fits on window resize) after layout settles.
    const refit = () => { try { window.dispatchEvent(new Event("resize")); } catch (e) {} };
    requestAnimationFrame(refit);
    setTimeout(refit, 160);
    setTimeout(refit, 450);
    const firstImg = bookElement.querySelector("img");
    if (firstImg && !firstImg.complete) firstImg.addEventListener("load", refit, { once: true });

    pageFlip.on("flip", () => {
      hint.classList.add("hidden");
      updateControls();
    });
    pageFlip.on("changeState", e => {
      // "read" = settled/idle; any other state = mid-flip
      bookWrap.classList.toggle("is-flipping", e.data !== "read");
      if (e.data === "read") updateControls(); // read the authoritative page index once settled
    });
    pageFlip.on("init", () => updateControls());

    progress.max = PAGE_COUNT - 1;
    if (start > 0) { try { pageFlip.turnToPage(start); } catch (e) {} }
    updateControls();
  }

  // ---- one-time UI bindings (always act on the current pageFlip instance) ----
  const flipPrev = () => { if (pageFlip) pageFlip.flipPrev("top"); };
  const flipNext = () => { if (pageFlip) pageFlip.flipNext("top"); };
  previousButtons.forEach(b => b.addEventListener("click", flipPrev));
  nextButtons.forEach(b => b.addEventListener("click", flipNext));
  document.querySelector("#first").addEventListener("click", () => pageFlip && pageFlip.turnToPage(0));
  document.querySelector("#last").addEventListener("click", () => pageFlip && pageFlip.turnToPage(PAGE_COUNT - 1));
  progress.addEventListener("input", e => pageFlip && pageFlip.turnToPage(Number(e.target.value)));

  document.addEventListener("keydown", e => {
    if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); flipNext(); }
    if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); flipPrev(); }
    if (e.key === "Home" && pageFlip) pageFlip.turnToPage(0);
    if (e.key === "End" && pageFlip) pageFlip.turnToPage(PAGE_COUNT - 1);
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
  document.addEventListener("fullscreenchange", () => {
    fsBtn.textContent = document.fullscreenElement ? "×" : "⛶";
    fsBtn.setAttribute("aria-label", document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen");
  });

  // ---- responsive: rebuild on breakpoint change, refit otherwise ----
  let rz;
  window.addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      // Rebuild only when crossing the mobile/desktop breakpoint; the engine re-fits
      // same-mode resizes itself (stretch mode listens to window resize).
      if (wantsPortrait() !== (mode === "portrait")) initFlip();
    }, 180);
  });
  window.addEventListener("orientationchange", () => setTimeout(initFlip, 260));

  // Most reliable cross-breakpoint trigger on real devices (rotate / window resize).
  const modeMQ = window.matchMedia(`(max-width: ${BREAKPOINT}px)`);
  if (modeMQ.addEventListener) modeMQ.addEventListener("change", () => initFlip());
  else if (modeMQ.addListener) modeMQ.addListener(() => initFlip()); // older Safari

  initFlip();
})();
