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

  /* ══ My Clients (§7.2, PR4a) ══════════════════════════════════════════════ */

  /* Roster search — client-side filter, no server round-trip. The roster is one coach's
     clients, so the list is small; this matches the Announcements search convention. */
  var search = $('cp-client-search');
  var rosterList = $('cp-roster-list');
  var noMatch = $('cp-roster-nomatch');

  if (search && rosterList) {
    var rows = [].slice.call(rosterList.querySelectorAll('.cp-roster-row'));
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (row) {
        var nameEl = row.querySelector('.cp-roster-name');
        var name = nameEl ? nameEl.textContent.toLowerCase() : '';
        var hit = !q || name.indexOf(q) !== -1;
        row.hidden = !hit;
        if (hit) shown++;
      });
      if (noMatch) noMatch.hidden = shown !== 0;
    });
  }

  /* Coach notes autosave — CP-F: 800ms debounce + on-blur, fire-and-forget.
     Same posture as the welcome-banner dismiss: a failed save surfaces in the hint and the
     text stays in the box, so nothing is silently lost. */
  var notes = $('cp-coach-notes');
  var notesHint = $('cp-notes-hint');

  function setHint(el, text, isError) {
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.style.color = isError ? 'var(--color-error)' : '';
  }

  if (notes) {
    var notesTimer = null;
    var lastSaved = notes.value;

    var saveNotes = function () {
      if (notes.value === lastSaved) return;
      var payload = notes.value;
      setHint(notesHint, 'Saving…', false);
      fetch('/coach/clients/' + notes.dataset.client + '/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ notes: payload }),
      }).then(function (r) {
        if (!r.ok) throw new Error('save failed');
        lastSaved = payload;
        setHint(notesHint, 'Autosaved', false);
      }).catch(function () {
        setHint(notesHint, 'Not saved — retrying on your next edit', true);
      });
    };

    notes.addEventListener('input', function () {
      clearTimeout(notesTimer);
      notesTimer = setTimeout(saveNotes, 800);
    });
    notes.addEventListener('blur', function () {
      clearTimeout(notesTimer);
      saveNotes();
    });
  }

  /* Coach debrief — checkbox + date, saved on change. The date is disabled until the box
     is ticked so "not completed, but completed on the 5th" is unrepresentable. */
  var dbDone = $('cp-debrief-done');
  var dbDate = $('cp-debrief-date');
  var dbWord = $('cp-debrief-word');
  var dbHint = $('cp-debrief-hint');
  var debrief = document.querySelector('.cp-debrief');

  if (dbDone && dbDate && debrief) {
    var saveDebrief = function () {
      setHint(dbHint, 'Saving…', false);
      fetch('/coach/clients/' + debrief.dataset.client + '/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ completed: dbDone.checked, date: dbDate.value || null }),
      }).then(function (r) {
        if (!r.ok) throw new Error('save failed');
        setHint(dbHint, 'Saved', false);
      }).catch(function () {
        setHint(dbHint, 'Not saved — please try again', true);
      });
    };

    dbDone.addEventListener('change', function () {
      var on = dbDone.checked;
      dbDate.disabled = !on;
      if (dbWord) {
        dbWord.textContent = on ? 'Yes' : 'No';
        dbWord.classList.toggle('cp-debrief-value--yes', on);
      }
      // Ticking the box with no date yet defaults to today — the common case is "I just
      // did the debrief", and it saves the coach a second interaction.
      if (on && !dbDate.value) {
        var t = new Date();
        dbDate.value = t.getFullYear() + '-' +
          String(t.getMonth() + 1).padStart(2, '0') + '-' +
          String(t.getDate()).padStart(2, '0');
      }
      if (!on) dbDate.value = '';
      saveDebrief();
    });
    dbDate.addEventListener('change', saveDebrief);
  }

  /* Create New Assessment modal → POST /coach/clients/provision (coach-scoped; the request
     carries no coachId — the server pins it to the session). */
  var modal = $('cp-modal');
  var openBtn = $('cp-new-assessment');
  var closeBtn2 = $('cp-modal-close');
  var cancelBtn = $('cp-modal-cancel');
  var submitBtn = $('cp-modal-submit');
  var modalMsg = $('cp-modal-msg');

  function setModal(open) {
    if (!modal) return;
    modal.hidden = !open;
    document.body.classList.toggle('cp-noscroll', open);
    if (!open && modalMsg) modalMsg.hidden = true;
  }

  if (openBtn) openBtn.addEventListener('click', function () { setModal(true); });
  if (closeBtn2) closeBtn2.addEventListener('click', function () { setModal(false); });
  if (cancelBtn) cancelBtn.addEventListener('click', function () { setModal(false); });
  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) setModal(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) setModal(false);
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      var picked = function (name) {
        var el = document.querySelector('input[name="' + name + '"]:checked');
        return el ? el.value === 'true' : false;
      };
      var noteEl = $('cp-m-notes');

      submitBtn.disabled = true;
      var original = submitBtn.textContent;
      submitBtn.textContent = 'Creating…';
      if (modalMsg) modalMsg.hidden = true;

      fetch('/coach/clients/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          firstName: submitBtn.dataset.first,
          lastName: submitBtn.dataset.last,
          email: submitBtn.dataset.email,
          organization: submitBtn.dataset.org || null,
          autoSendReport: picked('cp-report'),
          autoSendInvitation: picked('cp-invite'),
          notes: noteEl ? noteEl.value : null,
        }),
      }).then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, d: d }; });
      }).then(function (res) {
        if (!res.ok || !res.d.ok) throw new Error(res.d.message || 'Could not create the assessment.');
        window.location.reload();   // the new assessment appears at the top of the history
      }).catch(function (err) {
        if (modalMsg) {
          modalMsg.hidden = false;
          modalMsg.className = 'cp-modal-msg cp-modal-msg--err';
          modalMsg.textContent = err.message;
        }
        submitBtn.disabled = false;
        submitBtn.textContent = original;
      });
    });
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
