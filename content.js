// Reads the Disney+ title bug, works out which Bleach episode is playing, and
// pops a toast when the episode is filler or mixed.
//
// The title bug only stays on screen for a few seconds after an episode starts,
// so detection runs in two speeds. A fast poll runs for FAST_WINDOW_MS after
// every URL change, then a slow poll keeps running in case the bug comes back.
// The last good reading is cached against the player URL so the popup can still
// answer long after the bug has gone.
(function () {
  "use strict";

  var D = self.BLEACH;

  var FAST_POLL_MS = 750;
  var SLOW_POLL_MS = 3000;
  var FAST_WINDOW_MS = 90000;

  var settings = {
    seasonStarts: D.SEASON_STARTS.slice(),
    absoluteNumbering: false,
    quietCanon: true,
    skipSeriesCheck: false
  };

  var state = {
    pageKey: location.pathname,
    raw: null,
    season: null,
    episode: null,
    abs: null,
    status: null,
    seriesText: null,
    seriesOk: null,
    readAt: null
  };

  var lastToastAbs = null;
  var cachedSubtitle = null;
  var cachedBug = null;
  var fastUntil = Date.now() + FAST_WINDOW_MS;
  var pollTimer = null;
  var bugObserver = null;

  // ---------- finding the title bug ----------

  // Walks a root and every open shadow root beneath it.
  function eachRoot(root, visit, seen) {
    if (!root) return;
    seen = seen || new Set();
    if (seen.has(root)) return;
    seen.add(root);
    visit(root);
    var els = root.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      if (els[i].shadowRoot) eachRoot(els[i].shadowRoot, visit, seen);
    }
  }

  function findTitleBug() {
    if (cachedBug && cachedBug.isConnected) return cachedBug;
    cachedBug = document.querySelector("title-bug");
    if (cachedBug) return cachedBug;
    var found = null;
    eachRoot(document, function (root) {
      if (found) return;
      var el = root.querySelector && root.querySelector("title-bug");
      if (el) found = el;
    });
    cachedBug = found;
    return found;
  }

  var EPISODE_RE = /S(\d+)\s*:\s*E(\d+)/i;

  function findSubtitleText() {
    if (cachedSubtitle && cachedSubtitle.isConnected) {
      var cachedText = (cachedSubtitle.textContent || "").trim();
      if (EPISODE_RE.test(cachedText)) return cachedText;
    }
    var bug = findTitleBug();
    if (!bug) return null;
    var hit = null;
    eachRoot(bug.shadowRoot || bug, function (root) {
      if (hit) return;
      var nodes = root.querySelectorAll('[data-qa="title-bug.subtitle"], .subtitle-field, span');
      for (var i = 0; i < nodes.length; i++) {
        var text = (nodes[i].textContent || "").trim();
        if (EPISODE_RE.test(text)) {
          cachedSubtitle = nodes[i];
          hit = text;
          return;
        }
      }
    });
    return hit;
  }

  function findSeriesText() {
    var bug = findTitleBug();
    var parts = [document.title || ""];
    if (bug) {
      eachRoot(bug.shadowRoot || bug, function (root) {
        var el = root.querySelector('[data-qa="title-bug.title"], .title-field');
        if (el) parts.push(el.textContent || "");
      });
    }
    return parts.join(" | ").trim();
  }

  // Thousand-Year Blood War has its own numbering and no filler, so the
  // extension stays quiet there.
  function seriesLooksRight(text) {
    if (settings.skipSeriesCheck) return true;
    if (/thousand[\s-]*year/i.test(text)) return false;
    return /bleach/i.test(text);
  }

  // ---------- the toast ----------

  var host = null;
  var shadow = null;
  var hideTimer = null;

  function ensureToast() {
    if (host && host.isConnected) return;
    host = document.createElement("div");
    host.id = "bleach-filler-radar";
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;";
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML =
      '<style>' +
      ':host{all:initial}' +
      '.card{position:fixed;top:24px;right:24px;width:320px;box-sizing:border-box;' +
      'padding:14px 16px;border-radius:12px;background:#15151a;color:#f2f2f5;' +
      'font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
      'box-shadow:0 12px 32px rgba(0,0,0,.55);border-left:4px solid #8b8b94;' +
      'transform:translateX(380px);opacity:0;transition:transform .28s ease,opacity .28s ease}' +
      '.card.in{transform:translateX(0);opacity:1}' +
      '.head{display:flex;align-items:center;justify-content:space-between;gap:8px}' +
      '.kind{font-size:15px;font-weight:700;letter-spacing:.2px}' +
      '.ep{margin-top:2px;font-size:12px;color:#a0a0aa}' +
      '.detail{margin-top:8px;font-size:13px;color:#d4d4da}' +
      '.x{all:unset;cursor:pointer;color:#8b8b94;font-size:18px;line-height:1;padding:0 2px}' +
      '.x:hover{color:#f2f2f5}' +
      '</style>' +
      '<div class="card"><div class="head"><div>' +
      '<div class="kind"></div><div class="ep"></div></div>' +
      '<button class="x" title="Dismiss">×</button></div>' +
      '<div class="detail"></div></div>';
    shadow.querySelector(".x").addEventListener("click", hideToast);
    attachHost();
  }

  // Disney+ fullscreens the player element, which hides anything left on body.
  function attachHost() {
    var parent = document.fullscreenElement || document.body;
    if (host && host.parentNode !== parent) parent.appendChild(host);
  }

  document.addEventListener("fullscreenchange", attachHost);

  function showToast(info) {
    ensureToast();
    var card = shadow.querySelector(".card");
    card.style.borderLeftColor = D.COLORS[info.status];
    shadow.querySelector(".kind").textContent = info.title;
    shadow.querySelector(".kind").style.color = D.COLORS[info.status];
    shadow.querySelector(".ep").textContent = info.sub;
    shadow.querySelector(".detail").textContent = info.detail;
    requestAnimationFrame(function () {
      card.classList.add("in");
    });
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideToast, info.status === "canon" ? 4000 : 12000);
  }

  function hideToast() {
    if (!shadow) return;
    clearTimeout(hideTimer);
    shadow.querySelector(".card").classList.remove("in");
  }

  // ---------- working out what to say ----------

  function describe(abs) {
    var status = D.statusOf(abs);
    var run = D.runOf(abs);
    var detail;
    if (status === "filler") {
      var resume = run.end + 1;
      detail =
        "Filler run " + runLabel(run) + ". " +
        (resume <= D.LAST_EPISODE
          ? "Canon resumes at episode " + resume + "."
          : "Last run of the show.");
    } else if (status === "mixed") {
      var nextSkip = D.nextRun(abs, ["filler"]);
      detail =
        "Part canon, part filler, so worth watching. " +
        (nextSkip ? "Next full filler run starts at " + nextSkip.start + "." : "");
    } else if (status === "canon") {
      var nf = D.nextRun(abs, ["filler"]);
      detail = nf
        ? "Next filler run starts at " + nf.start + ", " + (nf.start - abs) + " episodes away."
        : "No filler left after this point.";
    } else {
      detail = "Episode " + abs + " is outside the 1–366 list.";
    }
    return {
      status: status,
      title: D.LABELS[status],
      sub: "Episode " + abs + (state.raw ? " · " + state.raw.replace(/\s+/g, " ") : ""),
      detail: detail.trim()
    };
  }

  function runLabel(run) {
    return run.start === run.end
      ? String(run.start)
      : run.start + "–" + run.end + " (" + run.length + " episodes)";
  }

  // ---------- the poll ----------

  function readOnce() {
    var text = findSubtitleText();
    if (!text) return false;
    var m = text.match(EPISODE_RE);
    if (!m) return false;

    var series = findSeriesText();
    var ok = seriesLooksRight(series);
    state.seriesText = series;
    state.seriesOk = ok;
    if (!ok) {
      state.raw = text;
      publish();
      return true;
    }

    var season = Number(m[1]);
    var episode = Number(m[2]);
    var abs = D.toAbsolute(season, episode, settings);

    var changed = abs !== state.abs;
    state.raw = text;
    state.season = season;
    state.episode = episode;
    state.abs = abs;
    state.status = D.statusOf(abs);
    state.readAt = Date.now();
    publish();

    if (changed && abs && lastToastAbs !== abs) {
      lastToastAbs = abs;
      var info = describe(abs);
      if (!(info.status === "canon" && settings.quietCanon)) showToast(info);
    }
    return true;
  }

  function publish() {
    try {
      chrome.runtime.sendMessage({ type: "bleach-status", status: state.seriesOk === false ? null : state.status });
    } catch (e) {
      /* the service worker may be asleep; the popup asks the tab directly */
    }
  }

  function tick() {
    readOnce();
    schedule();
  }

  function schedule() {
    clearTimeout(pollTimer);
    var fast = Date.now() < fastUntil;
    pollTimer = setTimeout(tick, fast ? FAST_POLL_MS : SLOW_POLL_MS);
  }

  function armFastWindow() {
    fastUntil = Date.now() + FAST_WINDOW_MS;
    schedule();
  }

  // A new player URL means a new episode, so forget the old reading.
  function checkPageKey() {
    if (location.pathname === state.pageKey) return;
    state.pageKey = location.pathname;
    state.raw = state.season = state.episode = state.abs = state.status = null;
    state.seriesOk = null;
    cachedSubtitle = null;
    cachedBug = null;
    lastToastAbs = null;
    hideToast();
    armFastWindow();
  }

  setInterval(checkPageKey, 500);
  window.addEventListener("popstate", checkPageKey);
  window.addEventListener("hashchange", checkPageKey);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) armFastWindow();
  });
  // The title bug reappears when playback starts or the controls are shown.
  document.addEventListener("play", armFastWindow, true);
  document.addEventListener("seeked", armFastWindow, true);

  // Catch the bug the moment it is inserted, rather than waiting for the poll.
  function watchBug() {
    var bug = findTitleBug();
    if (!bug || !bug.shadowRoot || bugObserver) return;
    bugObserver = new MutationObserver(function () {
      readOnce();
    });
    bugObserver.observe(bug.shadowRoot, { childList: true, subtree: true, characterData: true });
  }
  setInterval(watchBug, 5000);

  // ---------- settings and popup ----------

  chrome.storage.sync.get(null, function (stored) {
    if (stored && typeof stored === "object") {
      if (Array.isArray(stored.seasonStarts) && stored.seasonStarts.length) settings.seasonStarts = stored.seasonStarts;
      if (typeof stored.absoluteNumbering === "boolean") settings.absoluteNumbering = stored.absoluteNumbering;
      if (typeof stored.quietCanon === "boolean") settings.quietCanon = stored.quietCanon;
      if (typeof stored.skipSeriesCheck === "boolean") settings.skipSeriesCheck = stored.skipSeriesCheck;
    }
    tick();
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "sync") return;
    Object.keys(changes).forEach(function (key) {
      settings[key] = changes[key].newValue;
    });
    // Re-run the numbers under the new offsets.
    if (state.season && state.episode) {
      state.abs = D.toAbsolute(state.season, state.episode, settings);
      state.status = D.statusOf(state.abs);
      lastToastAbs = null;
      publish();
    }
    readOnce();
  });

  chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
    if (!msg || msg.type !== "bleach-query") return;
    readOnce();
    respond({
      ok: true,
      raw: state.raw,
      season: state.season,
      episode: state.episode,
      abs: state.abs,
      status: state.status,
      seriesText: state.seriesText,
      seriesOk: state.seriesOk,
      readAt: state.readAt,
      waiting: state.abs === null
    });
    return true;
  });
})();
