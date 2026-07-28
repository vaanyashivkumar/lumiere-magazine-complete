(() => {
  "use strict";

  // One image per magazine page, in reading order: pages/page-001.jpg … page-092.jpg
  const PAGE_COUNT = 92;

  const bookElement = document.querySelector("#book");
  const bookWrap = document.querySelector("#bookWrap");
  const progress = document.querySelector("#progress");
  const pageLabel = document.querySelector("#pageLabel");
  const hint = document.querySelector("#hint");
  const previousButtons = [document.querySelector("#previous"), document.querySelector("#footerPrevious")];
  const nextButtons = [document.querySelector("#next"), document.querySelector("#footerNext")];

  const images = Array.from({ length: PAGE_COUNT }, (_, index) =>
    `pages/page-${String(index + 1).padStart(3, "0")}.jpg`
  );
  let zoom = 1;

  if (!window.St?.PageFlip) {
    bookElement.innerHTML = '<p style="padding:2rem;color:white">The local page-turn engine could not be loaded.</p>';
    return;
  }

  // Build the page nodes. Cover and back cover are "hard" so they behave like a real cover.
  const pageElements = images.map((source, index) => {
    const page = document.createElement("div");
    page.className = "magazine-page";
    page.dataset.density = index === 0 || index === PAGE_COUNT - 1 ? "hard" : "soft";
    const image = document.createElement("img");
    image.src = source;
    image.alt = `Lumiere magazine page ${index + 1}`;
    image.draggable = false;
    image.decoding = "async";
    image.loading = index < 6 ? "eager" : "lazy";
    page.append(image);
    bookElement.append(page);
    return page;
  });

  const pageFlip = new St.PageFlip(bookElement, {
    width: 595,
    height: 842,
    size: "stretch",
    minWidth: 100,
    maxWidth: 1190,
    minHeight: 140,
    maxHeight: 1684,
    showCover: true,
    usePortrait: false,
    drawShadow: true,
    maxShadowOpacity: 0.62,
    flippingTime: 1050,
    startZIndex: 10,
    autoSize: false,
    mobileScrollSupport: false,
    swipeDistance: 24,
    clickEventForward: true,
    showPageCorners: true,
    disableFlipByClick: false
  });

  // HTML mode keeps the JPGs at native browser resolution (crisp text when zoomed).
  pageFlip.loadFromHTML(pageElements);

  const currentIndex = () => pageFlip.getCurrentPageIndex();

  function pageText(index) {
    if (index <= 0) return "Cover · Page 1 of 92";
    if (index >= PAGE_COUNT - 1) return "Back cover · Page 92 of 92";
    const left = index % 2 === 0 ? index : index + 1;
    return `Pages ${left}–${Math.min(left + 1, PAGE_COUNT)} of 92`;
  }

  function updateControls(index = currentIndex()) {
    const spread = index === 0 ? 0 : Math.ceil(index / 2);
    progress.value = spread;
    pageLabel.textContent = pageText(index);
    previousButtons.forEach(button => { button.disabled = index <= 0; });
    nextButtons.forEach(button => { button.disabled = index >= PAGE_COUNT - 1; });
    const atFront = index <= 0, atBack = index >= PAGE_COUNT - 1;
    bookWrap.classList.toggle("at-front", atFront);
    bookWrap.classList.toggle("at-back", atBack);
    // Center the lone cover / back cover AND scale it up to fill the screen (inline = reliable).
    // Scale respects both width and height so it never gets clipped on any phone.
    if (atFront || atBack) {
      const stage = document.querySelector("#stage");
      const pageW = bookWrap.offsetWidth / 2, pageH = bookWrap.offsetHeight;
      let s = Math.min(stage.clientWidth * 0.94 / pageW, stage.clientHeight * 0.94 / pageH);
      s = Math.max(1, Math.min(s, 2.4));
      bookWrap.style.transformOrigin = atFront ? "75% 50%" : "25% 50%";
      bookWrap.style.transform = `translateX(${atFront ? "-25%" : "25%"}) scale(calc(var(--zoom) * ${s.toFixed(3)}))`;
    } else {
      bookWrap.style.transformOrigin = "50% 50%";
      bookWrap.style.transform = "scale(var(--zoom))";
    }
  }

  pageFlip.on("flip", event => {
    hint.classList.add("hidden");
    bookWrap.classList.remove("is-flipping");
    updateControls(event.data);
  });
  pageFlip.on("init", event => updateControls(event.data.page));
  pageFlip.on("changeState", event => {
    bookWrap.classList.toggle("is-flipping", event.data === "flipping");
    if (event.data === "flipping") { bookWrap.style.transformOrigin = "50% 50%"; bookWrap.style.transform = "scale(var(--zoom))"; }
  });

  previousButtons.forEach(button => button.addEventListener("click", () => pageFlip.flipPrev("top")));
  nextButtons.forEach(button => button.addEventListener("click", () => pageFlip.flipNext("top")));
  document.querySelector("#first").addEventListener("click", () => pageFlip.turnToPage(0));
  document.querySelector("#last").addEventListener("click", () => pageFlip.turnToPage(PAGE_COUNT - 1));

  progress.max = Math.ceil(PAGE_COUNT / 2);
  progress.addEventListener("change", event => {
    const spread = Number(event.target.value);
    pageFlip.turnToPage(spread === 0 ? 0 : Math.min(spread * 2 - 1, PAGE_COUNT - 1));
  });

  document.addEventListener("keydown", event => {
    if (["ArrowRight", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      pageFlip.flipNext("top");
    }
    if (["ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault();
      pageFlip.flipPrev("top");
    }
    if (event.key === "Home") pageFlip.turnToPage(0);
    if (event.key === "End") pageFlip.turnToPage(PAGE_COUNT - 1);
  });

  function setZoom(value) {
    zoom = Math.max(.7, Math.min(1.5, value));
    document.documentElement.style.setProperty("--zoom", zoom);
    document.querySelector("#zoomValue").textContent = `${Math.round(zoom * 100)}%`;
  }
  document.querySelector("#zoomIn").addEventListener("click", () => setZoom(zoom + .1));
  document.querySelector("#zoomOut").addEventListener("click", () => setZoom(zoom - .1));

  const fullscreenButton = document.querySelector("#fullscreen");
  fullscreenButton.addEventListener("click", async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.textContent = document.fullscreenElement ? "×" : "⛶";
    fullscreenButton.setAttribute("aria-label", document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen");
  });
})();
