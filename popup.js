// Asks the active Disney+ tab what it last read, then shows the status of that
// episode and where the next filler run starts.
(function () {
  "use strict";

  var D = self.BLEACH;
  var settings = {
    seasonStarts: D.SEASON_STARTS.slice(),
    absoluteNumbering: false,
    quietCanon: true,
    skipSeriesCheck: false
  };
  var current = null;

  var el = function (id) { return document.getElementById(id); };

  function runLabel(run) {
    if (!run) return "—";
    return run.start === run.end
      ? "episode " + run.start
      : run.start + "–" + run.end + " (" + run.length + ")";
  }

  function render(info) {
    current = info;
    var found = info && info.abs && info.seriesOk !== false;
    el("state-waiting").hidden = !!found;
    el("state-found").hidden = !found;

    if (info && info.seriesOk === false) {
      el("waiting-hint").textContent =
        "This tab does not look like Bleach (2004). Thousand-Year Blood War is " +
        "numbered separately and has no filler. Tick the box below to run anyway.";
      return;
    }
    if (!found) {
      el("waiting-hint").textContent =
        "Open a Bleach episode on Disney+. The title bug only shows for a few " +
        "seconds, so move the mouse over the player or skip back a little.";
      return;
    }

    var abs = info.abs;
    var status = D.statusOf(abs);
    var run = D.runOf(abs);
    var nf = D.nextRun(abs, ["filler"]);
    var nm = D.nextRun(abs, ["mixed"]);

    el("kind").textContent = D.LABELS[status];
    el("kind").style.color = D.COLORS[status];
    el("sub").textContent = "Episode " + abs + (info.raw ? " · " + info.raw.replace(/\s+/g, " ") : "");

    var detail;
    if (status === "filler") {
      detail = run.end < D.LAST_EPISODE
        ? "Safe to skip. Canon resumes at episode " + (run.end + 1) + ", " + (run.end + 1 - abs) + " episodes away."
        : "Safe to skip. This is the last run of the show.";
    } else if (status === "mixed") {
      detail = "Part canon, part filler. Worth watching.";
    } else if (status === "canon") {
      detail = nf
        ? "Clear until episode " + nf.start + ", " + (nf.start - abs) + " episodes away."
        : "No filler left after this point.";
    } else {
      detail = "Episode " + abs + " sits outside the 1–366 list. Check the numbering below.";
    }
    el("detail").textContent = detail;

    el("run").textContent = run ? D.LABELS[run.status] + ", " + runLabel(run) : "—";
    el("next-filler").textContent = nf ? runLabel(nf) + ", in " + (nf.start - abs) : "none left";
    el("next-mixed").textContent = nm ? runLabel(nm) + ", in " + (nm.start - abs) : "none left";
    el("actual").value = abs;
  }

  function load() {
    chrome.storage.sync.get(null, function (stored) {
      if (stored && Array.isArray(stored.seasonStarts) && stored.seasonStarts.length) {
        settings.seasonStarts = stored.seasonStarts;
      }
      if (stored && typeof stored.absoluteNumbering === "boolean") settings.absoluteNumbering = stored.absoluteNumbering;
      if (stored && typeof stored.quietCanon === "boolean") settings.quietCanon = stored.quietCanon;
      if (stored && typeof stored.skipSeriesCheck === "boolean") settings.skipSeriesCheck = stored.skipSeriesCheck;
      el("absolute").checked = settings.absoluteNumbering;
      el("quiet").checked = settings.quietCanon;
      el("skipcheck").checked = settings.skipSeriesCheck;
      ask();
    });
  }

  function ask() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || !/disneyplus\.com/.test(tab.url || "")) {
        render(null);
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "bleach-query" }, function (res) {
        if (chrome.runtime.lastError || !res) {
          render(null);
          return;
        }
        render(res);
      });
    });
  }

  // Shifts the current season so the shown episode matches the real one.
  el("save").addEventListener("click", function () {
    var wanted = Number(el("actual").value);
    if (!current || !current.season || !wanted) return;
    var starts = settings.seasonStarts.slice();
    starts[current.season - 1] = wanted - (current.episode - 1);
    settings.seasonStarts = starts;
    chrome.storage.sync.set({ seasonStarts: starts }, function () {
      el("note").textContent = "Season " + current.season + " now starts at episode " + starts[current.season - 1] + ".";
      setTimeout(ask, 150);
    });
  });

  el("reset").addEventListener("click", function () {
    settings.seasonStarts = D.SEASON_STARTS.slice();
    chrome.storage.sync.set({ seasonStarts: settings.seasonStarts }, function () {
      el("note").textContent = "Season offsets reset.";
      setTimeout(ask, 150);
    });
  });

  [["absolute", "absoluteNumbering"], ["quiet", "quietCanon"], ["skipcheck", "skipSeriesCheck"]].forEach(function (pair) {
    el(pair[0]).addEventListener("change", function () {
      var patch = {};
      patch[pair[1]] = el(pair[0]).checked;
      settings[pair[1]] = patch[pair[1]];
      chrome.storage.sync.set(patch, function () { setTimeout(ask, 150); });
    });
  });

  load();
})();
