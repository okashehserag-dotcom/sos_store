(function () {
  const SOS_DATA = {
    tags: [
      { value: "all", label: "الكل" },
      { value: "new", label: "New" },
      { value: "popular", label: "Popular" },
      { value: "sale", label: "Sale" },
      { value: "limited", label: "Limited" }
    ],
    sections: [
      { id: "sec-1", title: "إصدارات جديدة", subtitle: "قريبًا", products: makeProducts("new", 10) },
      { id: "sec-2", title: "الأكثر طلبًا", subtitle: "قريبًا", products: makeProducts("popular", 10) },
      { id: "sec-3", title: "إكسسوارات", subtitle: "قريبًا", products: makeProducts("sale", 10) },
      { id: "sec-4", title: "Limited", subtitle: "قريبًا", products: makeProducts("limited", 10) }
    ]
  };

  function makeProducts(tag, count) {
    const img = "soon.png";
    return Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      const tags = i % 2 === 0 ? [tag] : [tag, "popular"];
      return {
        id: `${tag}-${n}`,
        title: `منتج ${n}`,
        desc: `وصف مختصر لمنتج ${n} — قريبًا.`,
        priceLabel: "Soon",
        image: img,
        tags
      };
    });
  }

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const LS = {
    likeKey: (id) => `sos_like_${id}`,
    reviewsKey: "sos_reviews_v1"
  };

  const state = {
    sections: SOS_DATA.sections,
    sectionUI: new Map()
  };

  document.addEventListener("DOMContentLoaded", () => {
    const y = $("#year");
    if (y) y.textContent = String(new Date().getFullYear());
    renderSections();
    initReviews();
    initReveal();
  });

  function renderSections() {
    const grid = $("#sectionsGrid");
    if (!grid) return;
    grid.innerHTML = "";

    state.sections.forEach((sec) => {
      const card = document.createElement("article");
      card.className = "card section-card";
      card.innerHTML = `
        <div class="section-card-head">
          <div>
            <h4>${esc(sec.title)}</h4>
            <p class="section-meta">${esc(sec.subtitle)}</p>
          </div>
          <div class="section-toggle">
            <span class="badge">${sec.products.length} منتجات</span>
            <button class="btn btn-ghost btn-sm" type="button" data-action="toggle" aria-expanded="false">فتح</button>
          </div>
        </div>

        <div class="section-body" id="${sec.id}-body">
          <div class="controls">
            <div class="field">
              <label for="${sec.id}-search">بحث داخل القسم</label>
              <input id="${sec.id}-search" type="search" placeholder="ابحث بالاسم أو الوصف..." />
            </div>
            <div class="field">
              <label for="${sec.id}-filter">فلترة</label>
              <select id="${sec.id}-filter"></select>
            </div>
          </div>

          <div class="slider">
            <div class="slider-top">
              <div class="slider-title">اسحب/استخدم الأسهم للتنقل</div>
              <div class="slider-actions">
                <button class="icon-btn" type="button" data-action="prev" aria-label="السابق">‹</button>
                <button class="icon-btn" type="button" data-action="next" aria-label="التالي">›</button>
              </div>
            </div>
            <div class="slider-viewport" data-role="viewport">
              <div class="slider-track" data-role="track"></div>
            </div>
          </div>

          <div class="hint" style="margin-top:10px;">
            <span data-role="count"></span>
          </div>
        </div>
      `;
      grid.appendChild(card);

      const filterEl = $(`#${sec.id}-filter`, card);
      filterEl.innerHTML = SOS_DATA.tags.map(t => `<option value="${t.value}">${esc(t.label)}</option>`).join("");

      state.sectionUI.set(sec.id, {
        open: false,
        filtered: sec.products.slice(),
        index: 0,
        perView: perView(),
        trackEl: null,
        viewportEl: null,
        cardEl: card
      });

      const toggleBtn = card.querySelector('[data-action="toggle"]');
      toggleBtn.addEventListener("click", () => toggleSection(sec.id));

      const searchEl = $(`#${sec.id}-search`, card);
      const apply = debounce(() => applyFilters(sec.id), 150);
      searchEl.addEventListener("input", apply);
      filterEl.addEventListener("change", () => applyFilters(sec.id));

      card.addEventListener("click", (ev) => {
        const b = ev.target.closest("button");
        if (!b) return;
        if (b.dataset.action === "prev") slidePrev(sec.id);
        if (b.dataset.action === "next") slideNext(sec.id);
      });

      window.addEventListener("resize", debounce(() => {
        const ui = state.sectionUI.get(sec.id);
        if (!ui || !ui.open) return;
        ui.perView = perView();
        clampIndex(sec.id);
        updateSlider(sec.id);
      }, 120));
    });
  }

  function toggleSection(id) {
    const ui = state.sectionUI.get(id);
    if (!ui) return;

    const body = $(`#${id}-body`, ui.cardEl);
    const btn = ui.cardEl.querySelector('[data-action="toggle"]');

    ui.open = !ui.open;
    body.classList.toggle("open", ui.open);
    btn.setAttribute("aria-expanded", String(ui.open));
    btn.textContent = ui.open ? "إغلاق" : "فتح";

    if (ui.open && !ui.trackEl) {
      ui.trackEl = body.querySelector('[data-role="track"]');
      ui.viewportEl = body.querySelector('[data-role="viewport"]');
      ui.filtered = getSection(id).products.slice();
      ui.index = 0;
      ui.perView = perView();
      renderSlides(id);
      initSwipe(id);
      updateCount(id);
      updateSlider(id);
      return;
    }

    if (ui.open) {
      updateSlider(id);
      updateCount(id);
    }
  }

  function applyFilters(id) {
    const ui = state.sectionUI.get(id);
    const sec = getSection(id);
    if (!ui || !sec) return;

    const searchEl = $(`#${id}-search`, ui.cardEl);
    const filterEl = $(`#${id}-filter`, ui.cardEl);
    const q = (searchEl.value || "").trim().toLowerCase();
    const tag = filterEl.value || "all";

    let items = sec.products.slice();
    if (tag !== "all") items = items.filter(p => (p.tags || []).includes(tag));
    if (q) items = items.filter(p => (p.title || "").toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q));

    ui.filtered = items;
    ui.index = 0;

    if (ui.open) {
      renderSlides(id);
      clampIndex(id);
      updateSlider(id);
      updateCount(id);
    }
  }

  function renderSlides(id) {
    const ui = state.sectionUI.get(id);
    if (!ui || !ui.trackEl) return;

    ui.trackEl.innerHTML = "";
    const items = ui.filtered;

    if (items.length === 0) {
      ui.trackEl.innerHTML = `
        <div class="slide" style="min-width:100%">
          <div class="slide-inner">
            <div class="slide-body">
              <h5 class="slide-title">لا توجد نتائج</h5>
              <p class="slide-desc">جرّب تغيير البحث أو الفلترة.</p>
              <div class="slide-foot"><span class="pill">SOS STORE</span></div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    items.forEach((p) => {
      const liked = isLiked(p.id);
      const el = document.createElement("div");
      el.className = "slide";
      el.innerHTML = `
        <div class="slide-inner">
          <div class="slide-media">
            <img src="${escAttr(p.image)}" alt="soon" loading="lazy" decoding="async">
          </div>
          <div class="slide-body">
            <h5 class="slide-title">${esc(p.title)}</h5>
            <p class="slide-desc">${esc(p.desc)}</p>
            <div class="slide-foot">
              <span class="pill">${esc(p.priceLabel || "Soon")}</span>
              <div class="like">
                <button class="like-btn" type="button" data-like="${escAttr(p.id)}" ${liked ? "disabled" : ""}>
                  ${liked ? "تم الإعجاب" : "أعجبني"}
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      ui.trackEl.appendChild(el);
    });

    ui.trackEl.onclick = (ev) => {
      const b = ev.target.closest("[data-like]");
      if (!b) return;
      const pid = b.dataset.like;
      if (!pid || isLiked(pid)) return;
      localStorage.setItem(LS.likeKey(pid), "1");
      b.textContent = "تم الإعجاب";
      b.disabled = true;
    };
  }

  function perView() {
    const w = window.innerWidth;
    if (w >= 1100) return 3;
    if (w >= 820) return 2;
    return 1;
  }

  function maxIndex(id) {
    const ui = state.sectionUI.get(id);
    if (!ui) return 0;
    const total = ui.filtered.length || 1;
    return Math.max(0, total - ui.perView);
  }

  function clampIndex(id) {
    const ui = state.sectionUI.get(id);
    if (!ui) return;
    ui.index = Math.max(0, Math.min(ui.index, maxIndex(id)));
  }

  function slidePrev(id) {
    const ui = state.sectionUI.get(id);
    if (!ui) return;
    ui.index = Math.max(0, ui.index - 1);
    updateSlider(id);
  }

  function slideNext(id) {
    const ui = state.sectionUI.get(id);
    if (!ui) return;
    ui.index = Math.min(maxIndex(id), ui.index + 1);
    updateSlider(id);
  }

  function updateSlider(id) {
    const ui = state.sectionUI.get(id);
    if (!ui || !ui.trackEl || !ui.viewportEl) return;

    const viewportW = ui.viewportEl.getBoundingClientRect().width;
    const gap = 12;
    const w = Math.max(240, (viewportW - gap * (ui.perView + 1)) / ui.perView);

    Array.from(ui.trackEl.children).forEach(sl => sl.style.minWidth = `${w}px`);
    ui.trackEl.style.transform = `translateX(${-ui.index * (w + gap)}px)`;

    const root = ui.trackEl.closest(".slider");
    if (!root) return;
    const prev = root.querySelector('[data-action="prev"]');
    const next = root.querySelector('[data-action="next"]');
    if (prev) prev.disabled = ui.index <= 0;
    if (next) next.disabled = ui.index >= maxIndex(id);
  }

  function initSwipe(id) {
    const ui = state.sectionUI.get(id);
    if (!ui || !ui.viewportEl) return;

    let x0 = null;
    let t0 = 0;

    ui.viewportEl.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      x0 = e.touches[0].clientX;
      t0 = Date.now();
    }, { passive: true });

    ui.viewportEl.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const x1 = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : x0;
      const dx = x1 - x0;
      const dt = Date.now() - t0;
      x0 = null;
      if (Math.abs(dx) < 38 || dt > 650) return;
      if (dx < 0) slideNext(id); else slidePrev(id);
    }, { passive: true });
  }

  function updateCount(id) {
    const ui = state.sectionUI.get(id);
    if (!ui) return;
    const body = $(`#${id}-body`, ui.cardEl);
    const c = body.querySelector('[data-role="count"]');
    if (!c) return;
    const total = ui.filtered.length;
    c.textContent = total === 0 ? "0 نتيجة" : `${total} منتج`;
  }

  function initReviews() {
    const form = $("#reviewForm");
    const list = $("#reviewsList");
    const clear = $("#clearReviews");
    const name = $("#reviewName");
    const rating = $("#reviewRating");
    const text = $("#reviewText");
    const count = $("#reviewCount");
    if (!form || !list) return;

    const render = () => {
      const items = getReviews();
      if (items.length === 0) {
        list.innerHTML = `<div class="review-item"><div class="review-top"><div class="review-name">لا يوجد تقييمات بعد</div><div class="review-stars">—</div></div><p class="review-text">كن أول من يضيف تقييمًا.</p></div>`;
        return;
      }
      list.innerHTML = items.slice(0, 12).map(r => {
        return `<div class="review-item"><div class="review-top"><div class="review-name">${esc(r.name)}</div><div class="review-stars">${stars(r.rating)} (${r.rating})</div></div><p class="review-text">${esc(r.text)}</p></div>`;
      }).join("");
    };

    text.addEventListener("input", () => count.textContent = String((text.value || "").length));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const n = (name.value || "").trim();
      const r = parseInt(rating.value, 10);
      const t = (text.value || "").trim();
      if (!n || !t || !Number.isFinite(r)) return;

      const items = getReviews();
      items.unshift({ name: n, rating: clamp(r, 1, 5), text: t, ts: Date.now() });
      localStorage.setItem(LS.reviewsKey, JSON.stringify(items.slice(0, 50)));

      form.reset();
      count.textContent = "0";
      render();
    });

    clear.addEventListener("click", () => {
      localStorage.removeItem(LS.reviewsKey);
      render();
    });

    render();
  }

  function getReviews() {
    try {
      const raw = localStorage.getItem(LS.reviewsKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function stars(n) {
    const full = "★".repeat(clamp(n, 0, 5));
    const empty = "☆".repeat(5 - clamp(n, 0, 5));
    return full + empty;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getSection(id) {
    return state.sections.find(s => s.id === id);
  }

  function isLiked(pid) {
    return localStorage.getItem(LS.likeKey(pid)) === "1";
  }

  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  }

  function escAttr(s) {
    return esc(s).replace(/`/g, "&#096;");
  }

  function initReveal() {
    const cards = $$(".section-card");
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.style.animation = "fadeUp 420ms cubic-bezier(.2,.8,.2,1) both";
        io.unobserve(en.target);
      });
    }, { threshold: 0.12 });
    cards.forEach(c => io.observe(c));
  }
})();
