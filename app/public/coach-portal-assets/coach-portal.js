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

  /* ══ Manage Credits (§7.4, PR6) ══════════════════════════════════════════ */

  /* Purchase modal: select a package → enable checkout + show total; Continue links out
     to the package's ThriveCart URL. No payment happens here. */
  var pModal = $('cp-purchase-modal');
  if (pModal) {
    var openP = $('cp-open-purchase');
    var closeP = $('cp-purchase-close');
    var checkoutBtn = $('cp-checkout-btn');
    var totalAmount = $('cp-total-amount');
    var pkgInputs = [].slice.call(pModal.querySelectorAll('input[name="cp-pkg"]'));

    var setP = function (open) {
      pModal.hidden = !open;
      document.body.classList.toggle('cp-noscroll', open);
    };
    var money = function (cents) { return '$' + (cents / 100).toFixed(2); };

    if (openP) openP.addEventListener('click', function () { setP(true); });
    if (closeP) closeP.addEventListener('click', function () { setP(false); });
    pModal.addEventListener('click', function (e) { if (e.target === pModal) setP(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pModal.hidden) setP(false); });

    pkgInputs.forEach(function (input) {
      input.addEventListener('change', function () {
        pModal.querySelectorAll('.cp-pkg').forEach(function (l) { l.classList.remove('cp-pkg--selected'); });
        if (input.checked) {
          input.closest('.cp-pkg').classList.add('cp-pkg--selected');
          totalAmount.textContent = money(parseInt(input.dataset.total, 10));
          checkoutBtn.disabled = false;
          checkoutBtn.dataset.url = input.dataset.url || '';
        }
      });
    });

    checkoutBtn.addEventListener('click', function () {
      var url = checkoutBtn.dataset.url;
      if (url) window.location.href = url;
    });
  }

  /* Post-purchase banner. Success/Failed dismiss and clean the ?purchase= off the URL so a
     refresh doesn't re-announce. Processing polls the account-scoped status endpoint every
     3s and, on 'complete', reloads so the new balance/lot/history row appear; after ~90s
     with no lot, it flips to Failed rather than spinning forever. */
  var banner = $('cp-purchase-banner');
  if (banner) {
    var stripPurchaseParams = function () {
      if (!(window.history && window.history.replaceState)) return;
      var u = new URL(window.location.href);
      u.searchParams.delete('purchase');
      u.searchParams.delete('order');
      window.history.replaceState({}, '', u.pathname + (u.search || ''));
    };

    var bClose = $('cp-banner-close');
    if (bClose) bClose.addEventListener('click', function () { banner.remove(); stripPurchaseParams(); });

    if (banner.dataset.state === 'processing') {
      var order = banner.dataset.order;
      var POLL_MS = 3000, TIMEOUT_MS = 90000, started = Date.now();
      var bText = $('cp-banner-text');

      var toFailed = function () {
        banner.className = 'cp-banner cp-banner--error';
        banner.dataset.state = 'failed';
        banner.innerHTML = '<span class="cp-banner-icon" aria-hidden="true"></span>' +
          '<span class="cp-banner-text">Purchase wasn’t completed — your credits haven’t changed. ' +
          'Need help? Contact <a href="mailto:support@insightoutenneagram.com">support@insightoutenneagram.com</a></span>' +
          '<button type="button" class="cp-banner-close" aria-label="Dismiss">&times;</button>';
        banner.querySelector('.cp-banner-close').addEventListener('click', function () { banner.remove(); stripPurchaseParams(); });
        stripPurchaseParams();
      };

      var poll = function () {
        if (!order) { toFailed(); return; }
        fetch('/coach/credits/purchase-status?order=' + encodeURIComponent(order), { credentials: 'same-origin' })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.status === 'complete') {
              // The lot landed — reload onto the Success state so stats/history reflect it.
              var u = new URL(window.location.href);
              u.searchParams.set('purchase', 'success');
              u.searchParams.delete('order');
              window.location.href = u.pathname + u.search;
              return;
            }
            if (Date.now() - started >= TIMEOUT_MS) { toFailed(); return; }
            setTimeout(poll, POLL_MS);
          })
          .catch(function () {
            if (Date.now() - started >= TIMEOUT_MS) { toFailed(); return; }
            setTimeout(poll, POLL_MS);
          });
      };
      setTimeout(poll, POLL_MS);
    }
  }

  /* History pagination — entirely client-side. The whole set is already in the DOM (rows
     carry the running balance from the server); JS just shows a window of them. Default
     page size follows the breakpoint (10 desktop/tablet, 5 mobile) via matchMedia, and the
     Show: selector overrides it. Matches the roster-search / low-volume precedent. */
  var history = $('cp-history');
  if (history) {
    var tbody = $('cp-htbody');
    var cardsWrap = $('cp-hcards');
    var sel = $('cp-pager-select');
    var indEl = $('cp-pager-ind');
    var countEl = $('cp-pager-count');
    var pagerBtns = [].slice.call(history.querySelectorAll('.cp-pager-btn'));

    var trRows = [].slice.call(tbody.querySelectorAll('.cp-hrow'));
    var cardRows = [].slice.call(cardsWrap.querySelectorAll('.cp-hrow'));
    var total = trRows.length;

    var isMobile = window.matchMedia('(max-width: 767px)').matches;
    var size = isMobile ? 5 : 10;
    sel.value = String(size);

    var page = 1;

    var render = function () {
      var pages = Math.max(1, Math.ceil(total / size));
      if (page > pages) page = pages;
      var start = (page - 1) * size;
      var end = start + size;

      for (var i = 0; i < total; i++) {
        var show = i >= start && i < end;
        trRows[i].style.display = show ? '' : 'none';
        if (cardRows[i]) cardRows[i].style.display = show ? '' : 'none';
      }

      var shownEnd = Math.min(end, total);
      countEl.textContent = 'Showing ' + (total ? (start + 1) : 0) + '–' + shownEnd + ' of ' + total + ' transaction' + (total === 1 ? '' : 's');
      indEl.textContent = 'Page ' + page + ' of ' + pages;

      var byPage = {};
      pagerBtns.forEach(function (b) { byPage[b.dataset.page] = b; });
      byPage.first.disabled = byPage.prev.disabled = (page <= 1);
      byPage.next.disabled = byPage.last.disabled = (page >= pages);
    };

    pagerBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var pages = Math.max(1, Math.ceil(total / size));
        var to = b.dataset.page;
        if (to === 'first') page = 1;
        else if (to === 'prev') page = Math.max(1, page - 1);
        else if (to === 'next') page = Math.min(pages, page + 1);
        else if (to === 'last') page = pages;
        render();
      });
    });

    sel.addEventListener('change', function () {
      size = parseInt(sel.value, 10) || 10;
      page = 1;
      render();
    });

    render();
  }

  /* ══ My Reports (§7.5, PR7) ═══════════════════════════════════════════════ */

  /* Report selector — open/close the list; a row is a normal link that reloads ?report=. */
  var rselToggle = $('cp-rsel-toggle');
  var rselList = $('cp-rsel-list');
  if (rselToggle && rselList) {
    var setRsel = function (open) {
      rselList.hidden = !open;
      rselToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    rselToggle.addEventListener('click', function (e) { e.stopPropagation(); setRsel(rselList.hidden); });
    document.addEventListener('click', function (e) { if (!rselList.hidden && !rselList.contains(e.target) && e.target !== rselToggle) setRsel(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !rselList.hidden) setRsel(false); });
  }

  /* Detail sections — three interaction models sharing ONE content source (server-rendered).
     - Desktop "More →" (.cp-more): always opens the modal.
     - Tablet/mobile row (.cp-sec-rowbtn): tablet opens the modal; mobile expands inline.
     The modal markup and the inline-body markup both exist in the DOM; JS only chooses. */
  var isMobileReports = function () { return window.matchMedia('(max-width: 767px)').matches; };

  function openSecModal(key) {
    var m = $('cp-secmodal-' + key);
    if (!m) return;
    m.hidden = false;
    document.body.classList.add('cp-noscroll');
  }
  function closeSecModals() {
    [].forEach.call(document.querySelectorAll('.cp-sec-modal'), function (m) { m.hidden = true; });
    document.body.classList.remove('cp-noscroll');
  }
  [].forEach.call(document.querySelectorAll('.cp-more'), function (btn) {
    btn.addEventListener('click', function () { openSecModal(btn.dataset.sec); });
  });
  [].forEach.call(document.querySelectorAll('.cp-sec-rowbtn'), function (btn) {
    btn.addEventListener('click', function () {
      if (isMobileReports()) {
        // Inline expand — push the following rows down, don't overlay.
        var item = btn.closest('.cp-sec-item');
        var body = item.querySelector('.cp-sec-inlinebody');
        var open = body.hidden;
        body.hidden = !open;
        item.classList.toggle('cp-sec-item--open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      } else {
        openSecModal(btn.dataset.sec);
      }
    });
  });
  [].forEach.call(document.querySelectorAll('.cp-sec-modal'), function (m) {
    var closeBtn = m.querySelector('.cp-sec-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSecModals);
    m.addEventListener('click', function (e) { if (e.target === m) closeSecModals(); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.querySelector('.cp-sec-modal:not([hidden])')) closeSecModals();
  });

  /* Mobile bar-chart More↓/Less↑ toggle — charts start collapsed on mobile (mockup). */
  var charts = $('cp-report-charts');
  var chartsToggle = $('cp-charts-toggle');
  if (charts && chartsToggle) {
    if (isMobileReports()) charts.classList.add('cp-charts--collapsed');
    chartsToggle.textContent = charts.classList.contains('cp-charts--collapsed') ? 'More ↓' : 'Less ↑';
    chartsToggle.addEventListener('click', function () {
      var collapsed = charts.classList.toggle('cp-charts--collapsed');
      chartsToggle.textContent = collapsed ? 'More ↓' : 'Less ↑';
    });
  }
})();

/* ══ Resources (§7.6, PR8) ═══════════════════════════════════════════════════
   Filter tabs (show/hide by category or content_type=video), per-section carousel dots
   (mobile/tablet), and the three modal variants (A Written / B PDF / C Video). Modals reuse
   .cp-modal-backdrop (centered desktop / bottom-sheet mobile). Written bodies lazy-load. */
(function () {
  var sectionsWrap = document.querySelector('.cp-res-sections');
  if (!sectionsWrap) return;   // not the Resources page

  var tabs = [].slice.call(document.querySelectorAll('.cp-res-tab'));
  var sections = [].slice.call(document.querySelectorAll('.cp-res-section'));
  var empty = document.querySelector('.cp-res-empty');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /* ── Carousel dots (mobile/tablet only; CSS hides the dot row on desktop) ── */
  function syncDots(sec) {
    var track = sec.querySelector('.cp-res-track');
    var dotWrap = sec.querySelector('.cp-res-dots');
    if (!track || !dotWrap) return;
    var cards = [].slice.call(track.querySelectorAll('.cp-res-card')).filter(function (c) { return c.style.display !== 'none'; });
    var dots = [].slice.call(dotWrap.querySelectorAll('.cp-dot'));
    dots.forEach(function (d, i) { d.style.display = i < cards.length ? '' : 'none'; });
    if (!cards.length) return;
    var trackLeft = track.getBoundingClientRect().left;
    var idx = 0, best = Infinity;
    cards.forEach(function (c, i) {
      var d = Math.abs(c.getBoundingClientRect().left - trackLeft);
      if (d < best) { best = d; idx = i; }
    });
    dots.forEach(function (d, i) { d.classList.toggle('cp-dot--active', i === idx); });
  }

  sections.forEach(function (sec) {
    var track = sec.querySelector('.cp-res-track');
    var dotWrap = sec.querySelector('.cp-res-dots');
    if (!track || !dotWrap) return;
    var raf;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = null; syncDots(sec); });
    });
    dotWrap.addEventListener('click', function (e) {
      var dot = e.target.closest('.cp-dot'); if (!dot) return;
      var i = [].slice.call(dotWrap.querySelectorAll('.cp-dot')).indexOf(dot);
      var cards = [].slice.call(track.querySelectorAll('.cp-res-card')).filter(function (c) { return c.style.display !== 'none'; });
      if (cards[i]) track.scrollTo({ left: track.scrollLeft + (cards[i].getBoundingClientRect().left - track.getBoundingClientRect().left), behavior: 'smooth' });
    });
  });

  /* ── Filter tabs ── */
  function applyFilter(key) {
    var anyVisible = false;
    sections.forEach(function (sec) {
      var cat = sec.getAttribute('data-category');
      var cards = [].slice.call(sec.querySelectorAll('.cp-res-card'));
      var secVisible = false;
      cards.forEach(function (card) {
        var show = key === 'all' || key === cat || (key === 'videos' && card.getAttribute('data-type') === 'video');
        card.style.display = show ? '' : 'none';
        if (show) secVisible = true;
      });
      sec.hidden = !secVisible;
      if (secVisible) anyVisible = true;
      var track = sec.querySelector('.cp-res-track');
      if (track) track.scrollLeft = 0;
      syncDots(sec);
    });
    if (empty) empty.hidden = anyVisible;
  }
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('cp-res-tab--active'); });
      tab.classList.add('cp-res-tab--active');
      applyFilter(tab.getAttribute('data-filter'));
    });
  });

  /* ── Modals ── */
  var backdrop = null;
  function closeModal() {
    if (backdrop) { backdrop.remove(); backdrop = null; document.body.classList.remove('cp-noscroll'); }
  }
  function openModal(panelHtml) {
    closeModal();
    backdrop = document.createElement('div');
    backdrop.className = 'cp-modal-backdrop';
    backdrop.innerHTML = panelHtml;
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closeModal(); });
    var closeBtn = backdrop.querySelector('.cp-res-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    document.body.appendChild(backdrop);
    document.body.classList.add('cp-noscroll');
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  function modalHead(el) {
    var badge = el.querySelector('.cp-res-badge');
    var sub = el.getAttribute('data-subtitle');
    return '<div class="cp-sheet-handle"></div>' +
      '<div class="cp-res-modal-head"><div>' + (badge ? badge.outerHTML : '') +
      '<h2 class="cp-res-modal-title">' + esc(el.getAttribute('data-title')) + '</h2></div>' +
      '<button type="button" class="cp-res-modal-close" aria-label="Close">&times;</button></div>' +
      (sub ? '<p class="cp-res-modal-sub">' + esc(sub) + '</p>' : '');
  }

  function openResource(el) {
    var family = el.getAttribute('data-family');
    var embed = el.getAttribute('data-embed');
    var url = el.getAttribute('data-url');
    if (family === 'video') {
      openModal('<div class="cp-res-modal">' + modalHead(el) +
        '<div class="cp-res-modal-body cp-res-modal-body--flush"><iframe class="cp-res-frame cp-res-frame--video" src="' + esc(embed) +
        '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div></div>');
    } else if (family === 'pdf') {
      openModal('<div class="cp-res-modal">' + modalHead(el) +
        '<div class="cp-res-modal-body cp-res-modal-body--flush"><iframe class="cp-res-frame cp-res-frame--pdf" src="' + esc(embed) + '"></iframe></div>' +
        '<div class="cp-res-modal-foot"><span>Having trouble viewing?</span><a href="' + esc(url) + '" target="_blank" rel="noopener">↓ Download PDF</a></div></div>');
    } else {
      openModal('<div class="cp-res-modal">' + modalHead(el) +
        '<div class="cp-res-modal-body"><div class="cp-res-prose" id="cp-res-bodytgt">Loading…</div></div></div>');
      fetch('/coach/resources/' + encodeURIComponent(el.getAttribute('data-id')) + '/body', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (d) { var t = document.getElementById('cp-res-bodytgt'); if (t) t.innerHTML = (d && d.ok) ? d.body : 'This resource is unavailable.'; })
        .catch(function () { var t = document.getElementById('cp-res-bodytgt'); if (t) t.textContent = 'This resource is unavailable.'; });
    }
  }

  [].slice.call(document.querySelectorAll('.cp-res-card, .cp-res-featured')).forEach(function (el) {
    el.addEventListener('click', function () { openResource(el); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openResource(el); } });
  });

  applyFilter('all');
})();

/* ── Coach Training event detail modal (PR14) ─────────────────────────────────────
   Deliberately a SEPARATE top-level IIFE (not inside the shared island above): the island
   runs page-specific sections that assume their own DOM, and a throw in any of them must not
   prevent the Training page's modal from binding. Self-contained — defines its own $.
   The grid is server-rendered; each event ships a hidden <template> carrying its detail HTML
   (already escaped server-side, with zoom_url deliberately absent). Clicking a card clones its
   template into the shared overlay. Register / Join Waitlist / Cancel buttons POST to the
   state-machine routes and reload on success. No-ops on pages without the overlay. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var overlay = $('cp-event-overlay');
  var body    = $('cp-event-modal-body');
  var closeEl = $('cp-event-modal-close');
  var templates = $('cp-event-templates');
  if (!overlay || !body || !templates) return;

  var lastFocus = null;

  function openEvent(id) {
    var tpl = templates.querySelector('template[data-event-id="' + id + '"]');
    if (!tpl) return;
    body.innerHTML = tpl.innerHTML;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    lastFocus = document.activeElement;
    var firstBtn = body.querySelector('button, a');
    if (firstBtn) firstBtn.focus();
  }
  function closeEvent() {
    overlay.hidden = true;
    body.innerHTML = '';
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  closeEl && closeEl.addEventListener('click', closeEvent);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeEvent(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) closeEvent(); });

  [].slice.call(document.querySelectorAll('.cp-event-card')).forEach(function (card) {
    card.addEventListener('click', function () { openEvent(card.getAttribute('data-event-id')); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEvent(card.getAttribute('data-event-id')); }
    });
  });

  // Delegated register/cancel actions inside the modal.
  body.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var id = btn.getAttribute('data-event-id');
    if (action !== 'register' && action !== 'cancel') return;
    e.preventDefault();
    var msg = body.querySelector('[data-event-msg]');
    btn.disabled = true;
    var orig = btn.textContent;
    btn.textContent = action === 'cancel' ? 'Cancelling…' : 'Registering…';
    fetch('/coach/training/events/' + encodeURIComponent(id) + '/' + action, {
      method: 'POST', headers: { Accept: 'application/json' },
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d && res.d.ok) { location.reload(); return; }
        btn.disabled = false; btn.textContent = orig;
        if (msg) { msg.hidden = false; msg.textContent = (res.d && res.d.message) || 'Something went wrong. Please try again.'; }
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = orig;
        if (msg) { msg.hidden = false; msg.textContent = 'Network error. Please try again.'; }
      });
  });
})();

/* ============================================================
   PR11 — My Profile (§7.9) + shared onboarding profile fields (§7.10)
   Mounted on BOTH surfaces. Every block below no-ops when its anchor element
   is absent, so the same file drives the two-column profile page and
   onboarding Screen 2 without branching on which page it is.
   ============================================================ */
(function () {
  'use strict';
  function byId(id) { return document.getElementById(id); }

  /* ── Shared success banner ────────────────────────────────────────────────
     Reuses the §7.8 My Account treatment (.cp-password-banner). One banner per
     page, fired by profile save, photo save and photo remove alike.
     Dismissal: the portal has no timeout/auto-dismiss convention (the account
     page simply leaves its banner up), so this follows suit — it stays visible
     until the next edit, at which point markDirty() clears it. */
  // Two banners, two locations: photo actions report next to the photo (it saves
  // instantly, so feedback beside a still-disabled Save button read as a no-op), field
  // saves report next to Save Changes. Showing one always clears the other, so a stale
  // "Photo updated." can never sit on screen alongside a later "Profile saved."
  var BANNER_IDS = ['cp-photo-banner', 'cp-profile-banner'];

  function hideBanner() {
    BANNER_IDS.forEach(function (id) {
      var b = byId(id);
      if (b) b.hidden = true;
    });
  }
  function showBanner(text, which) {
    hideBanner();
    var b = byId(which || 'cp-profile-banner');
    if (!b) return;
    var slot = b.querySelector('[data-banner-text]');
    if (slot) slot.textContent = text;
    b.hidden = false;
  }

  /* ── Dirty-state tracking for the Save Changes button ─────────────────────
     Compares a normalized snapshot of all six tracked fields against the value
     loaded from the server, so reverting an edit re-disables the button rather
     than leaving it armed. Photo actions are deliberately NOT tracked: the crop
     modal uploads immediately via fetch, so a photo is never pending a save. */
  function profileSnapshot() {
    var icf = Array.prototype.map.call(
      document.querySelectorAll('input[name="icf_designations"]:checked'),
      function (c) { return c.value; }).sort();
    var keywords = Array.prototype.map.call(
      document.querySelectorAll('#cp-tag-box .cp-tag'),
      function (t) { return t.getAttribute('data-tag'); });
    return JSON.stringify({
      bio: ((byId('cp-bio') || {}).value || '').trim(),
      icf: icf,
      alt: ((byId('cp-alt-email') || {}).value || '').trim(),
      phone: ((byId('cp-phone') || {}).value || '').trim(),
      optIn: !!(byId('cp-directory-optin') || {}).checked,
      // Keywords are compared in full regardless of the opt-in toggle, so that
      // toggling OFF and back ON — which preserves the tags per spec — nets out
      // clean instead of registering as a spurious edit.
      keywords: keywords
    });
  }

  var baseline = null;
  function refreshDirty() {
    var btn = byId('cp-profile-save');
    if (!btn || baseline === null) return;
    btn.disabled = (profileSnapshot() === baseline);
  }
  // Any edit invalidates a previously shown success banner.
  function markDirty() { hideBanner(); refreshDirty(); }
  function resetBaseline() { baseline = profileSnapshot(); refreshDirty(); }

  /* ── Circular crop modal ──────────────────────────────────────────────────
     Net-new: there was no crop/canvas code in the codebase before this. It
     exists because the server resize (sharp fit:'cover', position:'centre') is
     a blind centre-crop — fine for landscape event art, but it decapitates any
     headshot whose face isn't dead-centre. The coach picks the framing here and
     the server only ever resizes an already-square image.

     The canvas is the full square; the circular window is a CSS mask overlay so
     the coach can still see the parts of the photo falling outside the crop
     while dragging. Export is the inscribed square at 512px — the server
     produces the 96/256 variants from it. */
  // Canvas backing size. Must match the canvas element's width/height attributes; the
  // DISPLAY size is fluid (CSS), and pointer deltas are converted into backing units via
  // the stage's measured rect, so the two are allowed to differ.
  var STAGE = 320;
  var EXPORT = 512;     // upload resolution; >= the largest variant (256) for headroom

  var crop = {
    img: null, scale: 1, minScale: 1, x: 0, y: 0,
    dragging: false, lastX: 0, lastY: 0, onDone: null
  };

  function cropEls() {
    return {
      modal: byId('cp-crop-modal'), canvas: byId('cp-crop-canvas'),
      stage: byId('cp-crop-stage'), zoom: byId('cp-crop-zoom'),
      confirm: byId('cp-crop-confirm'), err: byId('cp-crop-err')
    };
  }

  // Keep the image covering the whole square at all times — no letterboxing gaps
  // can appear inside the circle regardless of pan or zoom.
  function clampCrop() {
    var w = crop.img.naturalWidth * crop.scale;
    var h = crop.img.naturalHeight * crop.scale;
    if (crop.x > 0) crop.x = 0;
    if (crop.y > 0) crop.y = 0;
    if (crop.x < STAGE - w) crop.x = STAGE - w;
    if (crop.y < STAGE - h) crop.y = STAGE - h;
  }

  function drawCrop() {
    var e = cropEls();
    if (!e.canvas || !crop.img) return;
    var ctx = e.canvas.getContext('2d');
    ctx.clearRect(0, 0, STAGE, STAGE);
    ctx.drawImage(crop.img, crop.x, crop.y,
      crop.img.naturalWidth * crop.scale, crop.img.naturalHeight * crop.scale);
  }

  function openCrop(file, onDone) {
    var e = cropEls();
    if (!e.modal) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        crop.img = img;
        crop.minScale = Math.max(STAGE / img.naturalWidth, STAGE / img.naturalHeight);
        crop.scale = crop.minScale;
        // Start centred.
        crop.x = (STAGE - img.naturalWidth * crop.scale) / 2;
        crop.y = (STAGE - img.naturalHeight * crop.scale) / 2;
        crop.onDone = onDone;
        if (e.zoom) e.zoom.value = 1;
        if (e.err) { e.err.hidden = true; e.err.textContent = ''; }
        clampCrop(); drawCrop();
        e.modal.hidden = false;
      };
      img.onerror = function () { window.alert('That file could not be read as an image.'); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function closeCrop() {
    var e = cropEls();
    if (e.modal) e.modal.hidden = true;
    crop.img = null; crop.onDone = null;
  }

  (function wireCrop() {
    var e = cropEls();
    if (!e.modal) return;

    // Pointer drag to reposition.
    e.stage.addEventListener('pointerdown', function (ev) {
      if (!crop.img) return;
      crop.dragging = true; crop.lastX = ev.clientX; crop.lastY = ev.clientY;
      e.stage.setPointerCapture(ev.pointerId);
    });
    e.stage.addEventListener('pointermove', function (ev) {
      if (!crop.dragging || !crop.img) return;
      // The canvas is displayed at CSS width that may differ from STAGE on mobile,
      // so translate pointer delta into backing-store units.
      var ratio = STAGE / e.stage.getBoundingClientRect().width;
      crop.x += (ev.clientX - crop.lastX) * ratio;
      crop.y += (ev.clientY - crop.lastY) * ratio;
      crop.lastX = ev.clientX; crop.lastY = ev.clientY;
      clampCrop(); drawCrop();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      e.stage.addEventListener(t, function () { crop.dragging = false; });
    });

    // Zoom about the centre of the circle so the subject doesn't drift.
    e.zoom.addEventListener('input', function () {
      if (!crop.img) return;
      var next = crop.minScale * parseFloat(e.zoom.value || '1');
      var cx = (STAGE / 2 - crop.x) / crop.scale;
      var cy = (STAGE / 2 - crop.y) / crop.scale;
      crop.scale = next;
      crop.x = STAGE / 2 - cx * crop.scale;
      crop.y = STAGE / 2 - cy * crop.scale;
      clampCrop(); drawCrop();
    });

    e.modal.addEventListener('click', function (ev) {
      // Backdrop click / Cancel — the backdrop IS the overlay element.
      if (ev.target === e.modal || ev.target.hasAttribute('data-crop-cancel')) closeCrop();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !e.modal.hidden) closeCrop();
    });

    e.confirm.addEventListener('click', function () {
      if (!crop.img) return;
      var out = document.createElement('canvas');
      out.width = EXPORT; out.height = EXPORT;
      var k = EXPORT / STAGE;
      out.getContext('2d').drawImage(crop.img, crop.x * k, crop.y * k,
        crop.img.naturalWidth * crop.scale * k, crop.img.naturalHeight * crop.scale * k);
      var done = crop.onDone;
      out.toBlob(function (blob) {
        if (!blob) { e.err.hidden = false; e.err.textContent = 'Could not process that image. Please try another.'; return; }
        if (done) done(blob);
      }, 'image/jpeg', 0.92);
    });
  })();

  /* ── Photo widget (upload + remove) ─────────────────────────────────────── */
  (function wirePhoto() {
    var trigger = byId('cp-photo-trigger');
    var file = byId('cp-photo-file');
    var circle = byId('cp-photo-circle');
    var removeBtn = byId('cp-photo-remove');
    var errEl = byId('cp-photo-err');
    if (!trigger || !file || !circle) return;

    function showErr(msg) { if (errEl) { errEl.hidden = false; errEl.textContent = msg; } }
    function clearErr() { if (errEl) { errEl.hidden = true; errEl.textContent = ''; } }

    function paint(url) {
      if (url) {
        circle.innerHTML = '<img src="' + url + '" alt="" class="cp-photo-img" id="cp-photo-img">';
        if (removeBtn) removeBtn.hidden = false;
      } else {
        // Onboarding has no header avatar to read from, so the initials ride on the
        // circle itself as a data attribute.
        var initials = circle.getAttribute('data-initials') || '';
        circle.innerHTML = '<span class="cp-photo-initials" id="cp-photo-initials">' + initials + '</span>';
        if (removeBtn) removeBtn.hidden = true;
      }
    }

    trigger.addEventListener('click', function () { clearErr(); file.click(); });

    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      clearErr();
      openCrop(f, function (blob) {
        var fd = new FormData();
        fd.append('photo', blob, 'avatar.jpg');
        var confirmBtn = byId('cp-crop-confirm');
        confirmBtn.disabled = true; confirmBtn.classList.add('cp-btn--loading');
        fetch('/coach/profile/photo', { method: 'POST', body: fd })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
          .then(function (res) {
            confirmBtn.disabled = false; confirmBtn.classList.remove('cp-btn--loading');
            if (res.ok && res.d && res.d.ok) {
              paint(res.d.photo_url); closeCrop();
              // "saved", not "updated": the photo persists the moment the crop is
              // confirmed, and the coach needs the copy to say so unambiguously —
              // Save Changes stays disabled, so nothing else confirms it.
              showBanner('Photo saved.', 'cp-photo-banner');
              return;
            }
            var e = cropEls();
            e.err.hidden = false;
            e.err.textContent = (res.d && res.d.message) || 'Could not save your photo. Please try again.';
          })
          .catch(function () {
            confirmBtn.disabled = false; confirmBtn.classList.remove('cp-btn--loading');
            var e = cropEls();
            e.err.hidden = false; e.err.textContent = 'Network error. Please try again.';
          });
      });
      // Allow re-selecting the same file after a cancel.
      file.value = '';
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        clearErr();
        removeBtn.disabled = true;
        fetch('/coach/profile/photo/remove', { method: 'POST', headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
          .then(function (res) {
            removeBtn.disabled = false;
            if (res.ok && res.d && res.d.ok) { paint(null); showBanner('Photo removed.', 'cp-photo-banner'); return; }
            showErr((res.d && res.d.message) || 'Could not remove your photo.');
          })
          .catch(function () { removeBtn.disabled = false; showErr('Network error. Please try again.'); });
      });
    }
  })();

  /* ── Directory opt-in → conditional keywords ────────────────────────────── */
  (function wireDirectoryToggle() {
    var toggle = byId('cp-directory-optin');
    var block = byId('cp-keywords');
    if (!toggle || !block) return;
    toggle.addEventListener('change', function () {
      // Spec §7.9: keywords are PRESERVED in state when toggled off, not deleted.
      // The tags stay in the DOM (and their hidden inputs with them); only visibility
      // changes. The server independently ignores keywords when opt-in is false.
      block.hidden = !toggle.checked;
      markDirty();
    });
  })();

  /* ── Keyword tag input with curated autocomplete ────────────────────────── */
  (function wireTags() {
    var wrap = byId('cp-keywords');
    var box = byId('cp-tag-box');
    var input = byId('cp-tag-input');
    var menu = byId('cp-tag-menu');
    var cap = byId('cp-tag-cap');
    if (!wrap || !box || !input || !menu) return;

    var max = parseInt(wrap.getAttribute('data-max'), 10) || 10;
    var MAX_LEN = parseInt(wrap.getAttribute('data-maxlen'), 10) || 40;
    var suggestions = null;   // lazy-loaded once

    function selected() {
      return Array.prototype.map.call(box.querySelectorAll('.cp-tag'), function (t) {
        return t.getAttribute('data-tag');
      });
    }
    function atCap() { return selected().length >= max; }

    function syncCap() {
      var full = atCap();
      input.disabled = full;
      input.placeholder = full ? '' : 'Type to search or add your own…';
      if (cap) cap.hidden = !full;
      if (full) hideMenu();
    }

    function showTagErr(msg) {
      if (!cap) return;
      cap.hidden = false;
      cap.textContent = msg;
      cap.setAttribute('data-transient', '1');
    }
    function clearTagErr() {
      if (cap && cap.getAttribute('data-transient')) {
        cap.removeAttribute('data-transient');
        cap.textContent = "You've reached the " + max + '-keyword limit.';
        cap.hidden = !atCap();
      }
    }

    function addTag(label) {
      if (!label || atCap()) return;
      clearTagErr();
      // Case-insensitive de-dupe, mirroring the server's normalizer.
      var lower = label.toLowerCase();
      var dup = selected().some(function (t) { return t.toLowerCase() === lower; });
      if (dup) { input.value = ''; hideMenu(); return; }
      var span = document.createElement('span');
      span.className = 'cp-tag';
      span.setAttribute('data-tag', label);
      span.textContent = label;
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'cp-tag-x'; x.innerHTML = '&times;';
      x.setAttribute('aria-label', 'Remove ' + label);
      span.appendChild(x);
      // Hidden input so onboarding's plain form POST still submits keywords[]
      // through the existing PR2 handler untouched.
      var hidden = document.createElement('input');
      hidden.type = 'hidden'; hidden.name = 'keywords'; hidden.value = label;
      span.appendChild(hidden);
      box.insertBefore(span, input);
      input.value = '';
      syncCap(); hideMenu();
      markDirty();            // adding a keyword is an edit
    }

    box.addEventListener('click', function (ev) {
      if (ev.target.classList.contains('cp-tag-x')) {
        ev.target.parentNode.remove();
        syncCap();
        markDirty();          // removing a keyword is an edit too
        return;
      }
      if (!input.disabled) input.focus();
    });

    function hideMenu() { menu.hidden = true; menu.innerHTML = ''; }

    function renderMenu(list) {
      menu.innerHTML = '';
      if (!list.length) {
        var none = document.createElement('li');
        none.className = 'cp-tag-empty';
        none.textContent = 'No matching keywords.';
        menu.appendChild(none);
      } else {
        list.forEach(function (label) {
          var li = document.createElement('li');
          li.className = 'cp-tag-option';
          li.setAttribute('role', 'option');
          li.textContent = label;
          li.addEventListener('mousedown', function (ev) { ev.preventDefault(); addTag(label); });
          menu.appendChild(li);
        });
      }
      menu.hidden = false;
    }

    function filterAndShow() {
      if (!suggestions || atCap()) return;
      var q = input.value.trim().toLowerCase();
      var chosen = selected();
      renderMenu(suggestions.filter(function (label) {
        return chosen.indexOf(label) === -1 && label.toLowerCase().indexOf(q) !== -1;
      }).slice(0, 20));
    }

    function loadSuggestions(then) {
      if (suggestions) { then(); return; }
      fetch('/coach/profile/keywords/suggestions', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (d) { suggestions = (d && d.keywords) || []; then(); })
        .catch(function () { suggestions = []; then(); });
    }

    input.addEventListener('focus', function () { loadSuggestions(filterAndShow); });
    input.addEventListener('input', function () { loadSuggestions(filterAndShow); });
    input.addEventListener('blur', function () { window.setTimeout(hideMenu, 120); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();   // never submit the onboarding form from the tag field
        // RATIFIED: Enter commits the TYPED TEXT, curated or not. Free text is saved to
        // this coach's profile only — it is never promoted into keyword_tags, which stays
        // a curated admin-managed set shared across every coach's autocomplete.
        var typed = input.value.trim();
        if (!typed) return;
        if (typed.length > MAX_LEN) {
          showTagErr('Keywords must be ' + MAX_LEN + ' characters or fewer.');
          return;
        }
        // If it matches a curated label case-insensitively, adopt the curated casing so
        // "Leadership" and "leadership" can't both end up on the same profile.
        var canonical = typed;
        if (suggestions) {
          for (var si = 0; si < suggestions.length; si++) {
            if (suggestions[si].toLowerCase() === typed.toLowerCase()) { canonical = suggestions[si]; break; }
          }
        }
        addTag(canonical);
      } else if (ev.key === 'Backspace' && !input.value) {
        var tags = box.querySelectorAll('.cp-tag');
        if (tags.length) { tags[tags.length - 1].remove(); syncCap(); }
      } else if (ev.key === 'Escape') {
        hideMenu();
      }
    });

    syncCap();
    // Preload the curated list when the block is already visible, so the casing-adoption
    // check on Enter isn't racing an in-flight fetch. When the block is hidden (directory
    // opt-in off) nothing is fetched until the coach actually opens it.
    if (!wrap.hidden) loadSuggestions(function () {});

  })();

  /* ── Edit Name + Name Change Confirmation Modal ─────────────────────────── */
  (function wireEditName() {
    var link = byId('cp-edit-name-link');
    var panel = byId('cp-edit-name');
    var nameBlock = byId('cp-identity-name');
    var first = byId('cp-first-name');
    var last = byId('cp-last-name');
    var saveBtn = byId('cp-save-name');
    var cancelBtn = byId('cp-cancel-name');
    var errEl = byId('cp-name-err');
    var modal = byId('cp-name-modal');
    if (!link || !panel || !modal) return;

    var origFirst = first.value, origLast = last.value;

    function expand(open) {
      panel.hidden = !open;
      nameBlock.hidden = open;
      link.hidden = open;
      if (errEl) errEl.hidden = true;
    }
    function closeModal() { modal.hidden = true; }

    link.addEventListener('click', function () { expand(true); });
    cancelBtn.addEventListener('click', function () {
      first.value = origFirst; last.value = origLast;
      expand(false);
    });

    saveBtn.addEventListener('click', function () {
      var f = first.value.trim(), l = last.value.trim();
      if (!f || !l) {
        errEl.hidden = false;
        errEl.textContent = 'Please enter both a first and last name.';
        return;
      }
      // §7.9: the confirmation modal always precedes the commit — the server
      // independently requires confirmed:true, so this can't be bypassed.
      byId('cp-name-modal-change').textContent =
        (origFirst + ' ' + origLast).trim() + '  →  ' + f + ' ' + l;
      byId('cp-name-modal-err').hidden = true;
      modal.hidden = false;
    });

    modal.addEventListener('click', function (ev) {
      if (ev.target === modal || ev.target.hasAttribute('data-name-cancel')) closeModal();
    });

    byId('cp-name-confirm').addEventListener('click', function () {
      var btn = this;
      var f = first.value.trim(), l = last.value.trim();
      btn.disabled = true; btn.classList.add('cp-btn--loading');
      fetch('/coach/profile/name', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: f, last_name: l, confirmed: true })
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          btn.disabled = false; btn.classList.remove('cp-btn--loading');
          if (res.ok && res.d && res.d.ok) {
            origFirst = f; origLast = l;
            byId('cp-identity-name-text').textContent = res.d.name;
            closeModal(); expand(false);
            return;
          }
          var em = byId('cp-name-modal-err');
          em.hidden = false;
          em.textContent = (res.d && res.d.message) || 'Could not update your name.';
        })
        .catch(function () {
          btn.disabled = false; btn.classList.remove('cp-btn--loading');
          var em = byId('cp-name-modal-err');
          em.hidden = false; em.textContent = 'Network error. Please try again.';
        });
    });
  })();

  /* ── Save profile (My Profile page only; onboarding posts its form) ─────── */
  (function wireProfileSave() {
    var saveBtn = byId('cp-profile-save');
    var cancelBtn = byId('cp-profile-cancel');
    var msg = byId('cp-save-msg');
    if (!saveBtn) return;

    function collect() {
      var icf = Array.prototype.map.call(
        document.querySelectorAll('input[name="icf_designations"]:checked'),
        function (c) { return c.value; });
      var keywords = Array.prototype.map.call(
        document.querySelectorAll('#cp-tag-box .cp-tag'),
        function (t) { return t.getAttribute('data-tag'); });
      return {
        bio: (byId('cp-bio') || {}).value || '',
        icf_designations: icf,
        alternate_email: (byId('cp-alt-email') || {}).value || '',
        phone: (byId('cp-phone') || {}).value || '',
        directory_opt_in: !!(byId('cp-directory-optin') || {}).checked,
        keywords: keywords
      };
    }

    function show(kind, text) {
      if (!msg) return;
      msg.hidden = false;
      msg.className = 'cp-save-msg cp-save-msg--' + kind;
      msg.textContent = text;
    }

    saveBtn.addEventListener('click', function () {
      if (msg) msg.hidden = true;
      saveBtn.disabled = true; saveBtn.classList.add('cp-btn--loading');
      fetch('/coach/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collect())
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          saveBtn.disabled = false; saveBtn.classList.remove('cp-btn--loading');
          if (res.ok && res.d && res.d.ok) {
            showBanner('Profile saved.', 'cp-profile-banner');
            resetBaseline();   // newly-saved values become the new clean state
            return;
          }
          show('err', (res.d && res.d.message) || 'Could not save your profile.');
        })
        .catch(function () {
          saveBtn.disabled = false; saveBtn.classList.remove('cp-btn--loading');
          show('err', 'Network error. Please try again.');
        });
    });

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () { window.location.reload(); });
    }

    // Track the four directly-edited controls; keywords and the directory toggle mark
    // themselves dirty from their own widgets above.
    ['cp-bio', 'cp-alt-email', 'cp-phone'].forEach(function (id) {
      var el = byId(id);
      if (el) el.addEventListener('input', markDirty);
    });
    Array.prototype.forEach.call(
      document.querySelectorAll('input[name="icf_designations"]'),
      function (c) { c.addEventListener('change', markDirty); });

    resetBaseline();   // capture the loaded state; Save starts disabled
  })();
})();
