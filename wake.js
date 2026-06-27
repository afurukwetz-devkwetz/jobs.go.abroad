/**
 * wake.js — Render cold-start detector
 * Pings /api/health on page load. If it takes > SLOW_MS or fails,
 * shows an animated "Server warming up…" banner with countdown.
 * Hides the banner as soon as the server responds successfully.
 */
(function () {
  const HEALTH_URL  = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '') + '/api/health';
  const SLOW_MS     = 4000;   // show banner if no reply within 4 s
  const MAX_WAIT_S  = 60;     // countdown ceiling in seconds
  const RETRY_MS    = 8000;   // re-ping interval while banner is shown

  const banner      = document.getElementById('wakeBanner');
  const secsEl      = document.getElementById('wakeSecs');
  const barFill     = document.getElementById('wakeBarFill');
  const retryBtn    = document.getElementById('wakeRetryBtn');

  let bannerShown   = false;
  let countdownSecs = MAX_WAIT_S;
  let countdownTmr  = null;
  let retryTmr      = null;
  let slowTmr       = null;

  // ── Show banner ──────────────────────────────────────────────
  function showBanner() {
    if (bannerShown) return;
    bannerShown     = true;
    countdownSecs   = MAX_WAIT_S;
    banner.style.display = 'block';
    document.body.classList.add('wake-active');
    // animate in
    requestAnimationFrame(() => banner.classList.add('wake-visible'));

    // tick countdown
    countdownTmr = setInterval(() => {
      countdownSecs = Math.max(0, countdownSecs - 1);
      if (secsEl) secsEl.textContent = countdownSecs;

      // progress bar fills from 0 → 100 % over MAX_WAIT_S
      const pct = ((MAX_WAIT_S - countdownSecs) / MAX_WAIT_S) * 100;
      if (barFill) barFill.style.width = pct + '%';

      // when countdown hits 0, show "Retry" button and reset
      if (countdownSecs === 0) {
        clearInterval(countdownTmr);
        if (retryBtn) retryBtn.style.display = 'inline-flex';
      }
    }, 1000);

    // keep re-pinging automatically
    retryTmr = setInterval(ping, RETRY_MS);
  }

  // ── Hide banner ──────────────────────────────────────────────
  function hideBanner() {
    if (!bannerShown) return;
    clearInterval(countdownTmr);
    clearInterval(retryTmr);
    clearTimeout(slowTmr);
    banner.classList.remove('wake-visible');
    document.body.classList.remove('wake-active');
    setTimeout(() => { banner.style.display = 'none'; }, 400);
    bannerShown = false;
  }

  // ── Ping health endpoint ─────────────────────────────────────
  function ping() {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10000);

    fetch(HEALTH_URL, { signal: controller.signal })
      .then(res => {
        clearTimeout(timeout);
        if (res.ok) hideBanner();
      })
      .catch(() => {
        clearTimeout(timeout);
        // server not yet awake — banner stays visible
        if (!bannerShown) showBanner();
      });
  }

  // ── Manual retry button ──────────────────────────────────────
  window.wakeRetry = function () {
    if (retryBtn) retryBtn.style.display = 'none';
    // reset countdown
    countdownSecs = MAX_WAIT_S;
    if (secsEl) secsEl.textContent = MAX_WAIT_S;
    if (barFill) barFill.style.width = '0%';
    // restart countdown timer
    if (countdownTmr) clearInterval(countdownTmr);
    countdownTmr = setInterval(() => {
      countdownSecs = Math.max(0, countdownSecs - 1);
      if (secsEl) secsEl.textContent = countdownSecs;
      const pct = ((MAX_WAIT_S - countdownSecs) / MAX_WAIT_S) * 100;
      if (barFill) barFill.style.width = pct + '%';
      if (countdownSecs === 0) {
        clearInterval(countdownTmr);
        if (retryBtn) retryBtn.style.display = 'inline-flex';
      }
    }, 1000);
    ping();
  };

  // ── Boot: give server SLOW_MS to reply before showing banner ─
  slowTmr = setTimeout(showBanner, SLOW_MS);
  ping(); // immediate first ping
})();
