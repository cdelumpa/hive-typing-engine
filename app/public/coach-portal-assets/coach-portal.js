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

  // Exposed so PR5's Step-2 CTA and the ?assessment=1 landing (State C1's "Continue to
  // Assessment") can open this same modal — no second modal mechanism.
  window.cpOpenAssessmentModal = function () { setModal(true); };

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

  /* ══ Retake workflow (§7.2, PR4b) ═════════════════════════════════════════ */

  /* Request a Retake modal */
  var rtModal = $('cp-retake-modal');
  var rtOpen = $('cp-request-retake');
  var rtClose = $('cp-retake-close');
  var rtCancel = $('cp-retake-cancel');
  var rtSubmit = $('cp-retake-submit');
  var rtReason = $('cp-retake-reason');
  var rtMsg = $('cp-retake-msg');

  function setRetakeModal(open) {
    if (!rtModal) return;
    rtModal.hidden = !open;
    document.body.classList.toggle('cp-noscroll', open);
    if (open && rtReason) rtReason.focus();
    if (!open && rtMsg) rtMsg.hidden = true;
  }
  function rtError(text) {
    if (!rtMsg) return;
    rtMsg.hidden = false;
    rtMsg.className = 'cp-modal-msg cp-modal-msg--err';
    rtMsg.textContent = text;
  }

  if (rtOpen) rtOpen.addEventListener('click', function () { setRetakeModal(true); });
  if (rtClose) rtClose.addEventListener('click', function () { setRetakeModal(false); });
  if (rtCancel) rtCancel.addEventListener('click', function () { setRetakeModal(false); });
  if (rtModal) {
    rtModal.addEventListener('click', function (e) { if (e.target === rtModal) setRetakeModal(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !rtModal.hidden) setRetakeModal(false);
    });
  }

  if (rtSubmit) {
    rtSubmit.addEventListener('click', function () {
      var reason = rtReason ? rtReason.value.trim() : '';
      if (!reason) { rtError('Please describe why this client needs a retake.'); return; }

      var original = rtSubmit.textContent;
      rtSubmit.disabled = true;
      rtSubmit.textContent = 'Submitting…';

      fetch('/coach/clients/' + rtSubmit.dataset.client + '/retake-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ reason: reason }),
      }).then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, d: d }; });
      }).then(function (res) {
        if (!res.ok || !res.d.ok) throw new Error(res.d.message || 'Could not submit the request.');
        window.location.reload();   // roster badge + pending pseudo-entry appear
      }).catch(function (err) {
        rtError(err.message);
        rtSubmit.disabled = false;
        rtSubmit.textContent = original;
      });
    });
  }

  /* Launch Retake — from the bottom CTA or the inline link on the approved pseudo-entry.
     Confirmed first: it spends a credit. */
  function launchRetake(requestId, btn) {
    if (!window.confirm('Launch this retake? It uses 1 Standard Assessment credit and sends a fresh invitation.')) return;

    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Launching…';

    fetch('/coach/retake-requests/' + requestId + '/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    }).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (res) {
      if (!res.ok || !res.d.ok) throw new Error(res.d.message || 'Could not launch the retake.');
      window.location.reload();   // the new assessment appears in the history
    }).catch(function (err) {
      window.alert(err.message);
      btn.disabled = false;
      btn.textContent = original;
    });
  }

  var launchBtn = $('cp-launch-retake');
  if (launchBtn) {
    launchBtn.addEventListener('click', function () { launchRetake(launchBtn.dataset.request, launchBtn); });
  }
  [].slice.call(document.querySelectorAll('.cp-launch-inline')).forEach(function (el) {
    el.addEventListener('click', function () { launchRetake(el.dataset.request, el); });
  });

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

  /* ══ Onboard a New Client (§7.3, PR5) ═════════════════════════════════════ */

  /* Success toast — dismissible, and never sticky across a reload (it's driven by
     ?created=1, so clearing the flag off the URL stops a refresh from re-announcing it). */
  var toast = $('cp-toast');
  var toastClose = $('cp-toast-close');
  if (toast && toastClose) {
    toastClose.addEventListener('click', function () { toast.remove(); });
    if (window.history && window.history.replaceState) {
      var clean = window.location.pathname + window.location.search.replace(/([?&])created=1&?/, '$1').replace(/[?&]$/, '');
      window.history.replaceState({}, '', clean);
    }
  }

  /* Step 2 CTA on a zero-assessment client opens the same PR4a modal as "+ New Assessment". */
  var step2 = $('cp-step2-assessment');
  if (step2 && typeof window.cpOpenAssessmentModal === 'function') {
    step2.addEventListener('click', function () { window.cpOpenAssessmentModal(); });
  }

  /* State C1's "Continue to Assessment" lands here with ?assessment=1 — open the modal
     straight away rather than making the coach click again. */
  if (/[?&]assessment=1/.test(window.location.search) && typeof window.cpOpenAssessmentModal === 'function') {
    window.cpOpenAssessmentModal();
  }

  /* ── Step 1 form: email-first lookup ──────────────────────────────────────── */
  var obForm  = $('cp-onboard-form');
  var obEmail = $('cp-ob-email');

  if (obForm && obEmail) {
    var obFirst  = $('cp-ob-first');
    var obLast   = $('cp-ob-last');
    var obOrg    = $('cp-ob-org');
    var obNotes  = $('cp-ob-notes');
    var obSave   = $('cp-onboard-save');
    var obFields = $('cp-onboard-fields');
    var obMsg    = $('cp-onboard-msg');
    var banner   = $('cp-lookup-banner');
    var spinner  = $('cp-lookup-spinner');
    var status   = $('cp-lookup-status');

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var lastLookedUp = null;   // don't re-fire for an unchanged email on every blur
    var state = 'none';        // none | own | other_coach
    var foundClientId = null;

    function setFieldsDisabled(off) {
      obFields.classList.toggle('cp-fields--disabled', off);
      [obFirst, obLast, obOrg, obNotes].forEach(function (el) { el.disabled = off; });
    }
    function setFieldsReadonly(on) {
      [obFirst, obLast, obOrg].forEach(function (el) { el.readOnly = on; });
    }
    function showBanner(cls, html) {
      banner.className = 'cp-lookup-banner ' + cls;
      banner.innerHTML = html;
      banner.hidden = false;
    }
    /* The banner interpolates a client NAME from the lookup response. That value came from
       the database, not from this page, so escape it — never innerHTML a server value raw. */
    function esc(s) {
      var d = document.createElement('div');
      d.textContent = s == null ? '' : String(s);
      return d.innerHTML;
    }

    /* Save is enabled only in the 'none' state with the required fields filled. In C1 the
       button becomes Continue to Assessment; in C2 there is no path forward at all. */
    function refreshSave() {
      if (state === 'other_coach') { obSave.disabled = true; return; }
      if (state === 'own') { obSave.disabled = false; return; }
      obSave.disabled = !(EMAIL_RE.test(obEmail.value.trim()) && obFirst.value.trim() && obLast.value.trim());
    }

    function resetToDefault() {
      // Leaving C1 must CLEAR the fields it pre-filled. Without this, a coach who looks up
      // an existing client and then types a different email keeps the previous client's
      // name in the form — and would silently save a brand-new client under someone else's
      // name. Only clear values we put there; never wipe what the coach typed themselves.
      if (state === 'own') {
        obFirst.value = '';
        obLast.value = '';
        obOrg.value = '';
      }
      state = 'none'; foundClientId = null;
      banner.hidden = true;
      obEmail.classList.remove('cp-input--found', 'cp-input--conflict', 'cp-input--checking');
      obEmail.readOnly = false;
      setFieldsDisabled(false);
      setFieldsReadonly(false);
      obSave.textContent = 'Save Client';
      refreshSave();
    }

    function applyState(data) {
      spinner.hidden = true;
      status.hidden = true;
      obEmail.classList.remove('cp-input--checking');

      if (data.state === 'own') {
        state = 'own';
        foundClientId = data.client.id;
        obEmail.classList.add('cp-input--found');
        obEmail.readOnly = true;
        obFirst.value = data.client.first_name || '';
        obLast.value  = data.client.last_name || '';
        obOrg.value   = data.client.organization || '';
        setFieldsDisabled(false);
        setFieldsReadonly(true);
        var nm = ((data.client.first_name || '') + ' ' + (data.client.last_name || '')).trim();
        showBanner('cp-lookup-banner--own',
          '<b>' + esc(nm) + '</b> is already in your roster. We’ve filled in their details — continue to provision a new assessment.');
        obSave.textContent = 'Continue to Assessment →';
        refreshSave();
        return;
      }

      if (data.state === 'other_coach') {
        state = 'other_coach';
        obEmail.classList.add('cp-input--conflict');
        setFieldsDisabled(true);
        showBanner('cp-lookup-banner--other',
          'This email is already associated with another coach’s client roster. If you believe this is an error, contact Hive support.');
        obSave.textContent = 'Save Client';
        refreshSave();
        return;
      }

      resetToDefault();
    }

    /* Lookup fires on BLUR, not per keystroke (addendum) — an email isn't meaningful until
       the coach has finished typing it, and per-keystroke would hammer the endpoint. */
    obEmail.addEventListener('blur', function () {
      var email = obEmail.value.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) { resetToDefault(); lastLookedUp = null; return; }
      if (email === lastLookedUp) return;
      lastLookedUp = email;

      // State B — checking.
      banner.hidden = true;
      obEmail.classList.remove('cp-input--found', 'cp-input--conflict');
      obEmail.classList.add('cp-input--checking');
      spinner.hidden = false;
      status.hidden = false;
      setFieldsDisabled(true);

      fetch('/coach/clients/lookup?email=' + encodeURIComponent(email), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { state: 'none' }; })
        .then(applyState)
        .catch(function () {
          // A failed lookup must not trap the coach — fall back to the plain form. The
          // server-side gate still refuses a cross-coach save, so this is safe.
          resetToDefault();
          lastLookedUp = null;
        });
    });

    [obFirst, obLast].forEach(function (el) { el.addEventListener('input', refreshSave); });
    obEmail.addEventListener('input', refreshSave);

    obForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (obSave.disabled) return;

      // C1 — the client already exists and is theirs. Do NOT re-save (that would be a
      // no-op round trip at best); go straight to their detail page with the modal open.
      if (state === 'own' && foundClientId) {
        window.location.href = '/coach/clients/' + foundClientId + '?assessment=1';
        return;
      }
      if (state === 'other_coach') return;

      obMsg.hidden = true;
      obSave.disabled = true;
      var original = obSave.textContent;
      obSave.textContent = 'Saving…';

      fetch('/coach/clients/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          firstName: obFirst.value.trim(),
          lastName: obLast.value.trim(),
          email: obEmail.value.trim().toLowerCase(),
          organization: obOrg.value.trim() || null,
          notes: obNotes.value || null,
        }),
      }).then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, d: d }; });
      }).then(function (res) {
        if (!res.ok) {
          obMsg.className = 'cp-modal-msg cp-modal-msg--err';
          obMsg.textContent = res.d.message || 'Something went wrong. Please try again.';
          obMsg.hidden = false;
          obSave.textContent = original;
          refreshSave();
          return;
        }
        window.location.href = '/coach/clients/' + res.d.clientId + '?created=1';
      }).catch(function () {
        obMsg.className = 'cp-modal-msg cp-modal-msg--err';
        obMsg.textContent = 'Network error — please try again.';
        obMsg.hidden = false;
        obSave.textContent = original;
        refreshSave();
      });
    });

    refreshSave();
  }
})();
