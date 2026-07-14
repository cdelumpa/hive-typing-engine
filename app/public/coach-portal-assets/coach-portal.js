/* ============================================================================
   InsightOut Coach Portal — client JS island (PR3)
   Source of truth: Coach Portal Design Spec v2.2 + §7.1 Dashboard Addendum v1.0.

   The portal is server-rendered (CP-ARCH). This file is deliberately a small UI-only
   island: it opens/closes the mobile drawer, syncs the mobile carousel dots, toggles the
   avatar menu, and dismisses the welcome banner. It renders no content and fetches no
   data — every value on the page came from the server. Keep it that way.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ── Mobile drawer (addendum §"Mobile nav") ───────────────────────────────── */
  var drawer    = $('cp-drawer');
  var hamburger = $('cp-hamburger');
  var closeBtn  = $('cp-drawer-close');

  function setDrawer(open) {
    if (!drawer || !hamburger) return;
    drawer.hidden = !open;
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    // Lock the page behind the full-screen overlay so it can't scroll under it.
    document.body.classList.toggle('cp-noscroll', open);
    if (open && closeBtn) closeBtn.focus();
    else if (!open) hamburger.focus();
  }

  if (hamburger) hamburger.addEventListener('click', function () { setDrawer(drawer.hidden); });
  if (closeBtn)  closeBtn.addEventListener('click', function () { setDrawer(false); });

  /* ── Avatar menu ──────────────────────────────────────────────────────────── */
  var avatarBtn  = $('cp-avatar-btn');
  var avatarMenu = $('cp-avatar-menu');

  function setAvatarMenu(open) {
    if (!avatarBtn || !avatarMenu) return;
    avatarMenu.hidden = !open;
    avatarBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (avatarBtn) {
    avatarBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setAvatarMenu(avatarMenu.hidden);
    });
    document.addEventListener('click', function (e) {
      if (avatarMenu && !avatarMenu.hidden && !avatarMenu.contains(e.target)) setAvatarMenu(false);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (drawer && !drawer.hidden) setDrawer(false);
    if (avatarMenu && !avatarMenu.hidden) setAvatarMenu(false);
  });

  /* ── Action-card carousel dots (mobile) ───────────────────────────────────── */
  // The cards are a CSS scroll-snap track; JS only reflects scroll position into the
  // dots and lets a dot tap scroll the matching card into view.
  var track = $('cp-actions-track');
  var dotWrap = $('cp-actions-dots');

  if (track && dotWrap) {
    var dots = [].slice.call(dotWrap.querySelectorAll('.cp-dot'));
    var cards = [].slice.call(track.querySelectorAll('.cp-action-card'));

    var syncDots = function () {
      if (!cards.length) return;
      // Nearest card to the track's left edge wins — robust to partial scroll positions.
      var best = 0, bestDist = Infinity;
      for (var i = 0; i < cards.length; i++) {
        var d = Math.abs(cards[i].offsetLeft - track.scrollLeft);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      for (var j = 0; j < dots.length; j++) {
        dots[j].classList.toggle('cp-dot--active', j === best);
      }
    };

    var ticking = false;
    track.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { syncDots(); ticking = false; });
    }, { passive: true });

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        if (cards[i]) track.scrollTo({ left: cards[i].offsetLeft, behavior: 'smooth' });
      });
    });

    syncDots();
  }

  /* ── Welcome banner dismiss (§7.10 Screen 2B) ─────────────────────────────── */
  // Hide optimistically so the banner never lingers, then persist. If the POST fails the
  // flag stays false server-side and the banner returns on the next load — the correct
  // failure mode (we'd rather re-show it than silently swallow the dismissal).
  var welcome = $('cp-welcome');
  var welcomeClose = $('cp-welcome-close');

  if (welcome && welcomeClose) {
    welcomeClose.addEventListener('click', function () {
      welcome.remove();
      fetch('/coach/onboarding/welcome/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      }).catch(function () { /* non-fatal: banner reappears next load */ });
    });
  }
})();
