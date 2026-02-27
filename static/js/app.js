(async function main() {
  const { createAnalogClock } = await import("./clock.js");
  const { startSSE } = await import("./sse.js");

  const countrySelect = document.getElementById("countrySelect");
  const citySelect = document.getElementById("citySelect");
  const btnApplyCountryCity = document.getElementById("btnApplyCountryCity");

  const citySearch = document.getElementById("citySearch");
  const citySuggest = document.getElementById("citySuggest");

  const digitalTime = document.getElementById("digitalTime");
  const digitalDate = document.getElementById("digitalDate");
  const featuredTzLabel = document.getElementById("featuredTzLabel");

  const selCountry = document.getElementById("selCountry");
  const selCity = document.getElementById("selCity");
  const selTz = document.getElementById("selTz");

  const worldGrid = document.getElementById("worldGrid");
  const btnRefreshWorld = document.getElementById("btnRefreshWorld");
  const btnUseLocalTz = document.getElementById("btnUseLocalTz");
  const themePill = document.getElementById("themePill");

  const canvas = document.getElementById("analogClock");
  const analog = createAnalogClock(canvas);

  let stopStream = null;
  let currentTz = "UTC";
  let currentCountry = "";
  let currentCity = "";

  // ---------- Helpers ----------
  function setSelectedMeta(country, city, tz) {
    currentCountry = country || "";
    currentCity = city || "";
    currentTz = tz || "UTC";

    selCountry.textContent = currentCountry || "—";
    selCity.textContent = currentCity || "—";
    selTz.textContent = currentTz || "—";
    featuredTzLabel.textContent = `Timezone: ${currentTz}`;
  }

  async function applyTheme(country, city) {
    const qs = new URLSearchParams();
    if (country) qs.set("country", country);
    if (city) qs.set("city", city);

    const res = await fetch(`/api/theme?${qs.toString()}`);
    const data = await res.json();
    const theme = data.theme || {};

    const accent = theme.accent || "#7dd3fc";
    const accent2 = theme.accent2 || "#a78bfa";
    const label = theme.overlayLabel || "Default";

    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent2", accent2);

    analog.setThemeColors(accent, accent2);
    themePill.textContent = `Theme: ${label}`;
  }

  function startClockStream(tz) {
    if (stopStream) stopStream();
    const url = `/stream/time?tz=${encodeURIComponent(tz)}`;

    stopStream = startSSE(
      url,
      (payload) => {
        digitalTime.textContent = payload.time;
        digitalDate.textContent = payload.date;
        analog.render(payload);
      },
      () => {}
    );
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showSuggest(items) {
    if (!items || items.length === 0) {
      citySuggest.style.display = "none";
      citySuggest.innerHTML = "";
      return;
    }

    citySuggest.style.display = "block";
    citySuggest.innerHTML = items
      .map(
        (x, idx) => `
        <div class="suggest-item" data-idx="${idx}">
          <div><b>${escapeHtml(x.city)}</b> <span class="suggest-muted">(${escapeHtml(x.country)})</span></div>
          <div class="suggest-muted">${escapeHtml(x.tz)}</div>
        </div>
      `
      )
      .join("");
  }

  // ---------- World Grid ----------
  async function loadWorldGrid() {
    worldGrid.innerHTML = "";
    const res = await fetch("/api/world_times");
    const data = await res.json();
    const items = data.items || [];

    worldGrid.innerHTML = items
      .map(
        (x) => `
        <div class="world-card-item">
          <div class="world-tz">${escapeHtml(x.tz)}</div>
          <div class="world-time">${escapeHtml(x.time)}</div>
          <div class="world-date">${escapeHtml(x.date)}</div>
        </div>
      `
      )
      .join("");
  }

  btnRefreshWorld?.addEventListener("click", loadWorldGrid);

  // ---------- Country -> Cities ----------
  countrySelect?.addEventListener("change", async () => {
    const country = countrySelect.value;

    citySelect.innerHTML = `<option value="">Select a city</option>`;
    citySelect.disabled = true;
    btnApplyCountryCity.disabled = true;

    if (!country) return;

    const res = await fetch(`/api/search/country/${encodeURIComponent(country)}`);
    const data = await res.json();

    if (!res.ok) {
      alert(data?.error?.message || "Failed to load cities");
      return;
    }

    const cities = data.cities || [];
    for (const c of cities) {
      const opt = document.createElement("option");
      opt.value = c.city;
      opt.textContent = c.city;
      // Keep timezone in the option
      opt.setAttribute("data-tz", c.tz);
      citySelect.appendChild(opt);
    }

    citySelect.disabled = false;
  });

  citySelect?.addEventListener("change", () => {
    btnApplyCountryCity.disabled = !(countrySelect.value && citySelect.value);
  });

  // ✅ FIXED: Show Time (country+city) uses /api/resolve (accurate)
  btnApplyCountryCity?.addEventListener("click", async () => {
    const country = countrySelect.value;
    const city = citySelect.value;

    if (!country || !city) return;

    const res = await fetch(
      `/api/resolve?country=${encodeURIComponent(country)}&city=${encodeURIComponent(city)}`
    );
    const data = await res.json();

    if (!res.ok) {
      alert(data?.error?.message || "Failed to resolve time");
      return;
    }

    setSelectedMeta(data.country, data.city, data.tz);
    await applyTheme(data.country, data.city);

    // Show instantly
    digitalTime.textContent = data.time;
    digitalDate.textContent = data.date;
    analog.render(data);

    // Then stream live
    startClockStream(data.tz);
  });

  // ---------- City Search ----------
  let lastResults = [];

  const doCitySearch = debounce(async () => {
    const q = citySearch.value.trim();
    if (q.length < 2) {
      showSuggest([]);
      return;
    }
    const res = await fetch(`/api/search/city?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    lastResults = data.results || [];
    showSuggest(lastResults);
  }, 180);

  citySearch?.addEventListener("input", doCitySearch);

  // ✅ FIXED: clicking a suggestion shows time instantly and starts SSE
  citySuggest?.addEventListener("click", async (ev) => {
    const item = ev.target.closest(".suggest-item");
    if (!item) return;

    const idx = parseInt(item.getAttribute("data-idx"), 10);
    const x = lastResults[idx];
    if (!x) return;

    citySearch.value = `${x.city}`;
    showSuggest([]);

    // Get time instantly using tz
    const res = await fetch(`/api/time?tz=${encodeURIComponent(x.tz)}`);
    const data = await res.json();

    if (!res.ok) {
      alert(data?.error?.message || "Failed to fetch time");
      return;
    }

    // Attach city/country for UI display
    data.city = x.city;
    data.country = x.country;

    setSelectedMeta(x.country, x.city, x.tz);
    await applyTheme(x.country, x.city);

    digitalTime.textContent = data.time;
    digitalDate.textContent = data.date;
    analog.render(data);

    startClockStream(x.tz);
  });

  document.addEventListener("click", (ev) => {
    if (!citySuggest.contains(ev.target) && ev.target !== citySearch) {
      showSuggest([]);
    }
  });

  // ---------- Use Local Timezone ----------
  btnUseLocalTz?.addEventListener("click", async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setSelectedMeta("", "My Timezone", tz);
    await applyTheme("", "");
    startClockStream(tz);
  });

  // ---------- Initial ----------
  await loadWorldGrid();

  const tz0 = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  setSelectedMeta("", "My Timezone", tz0);
  await applyTheme("", "");
  startClockStream(tz0);
})();