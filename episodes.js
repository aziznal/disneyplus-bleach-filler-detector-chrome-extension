// Bleach (2004) filler data, transcribed from the Quick List on animefillerlist.com.
// Kept as the original text so it can be diffed against the source by eye.
(function (scope) {
  "use strict";

  var SOURCE = {
    canon:
      "1-7, 9-26, 28-31, 34-45, 47-49, 51-63, 110, 112-115, 117-118, 121-123, " +
      "125-127, 138-140, 142, 144-145, 150-155, 157-159, 162-167, 191-192, " +
      "194-203, 208, 210-212, 215-221, 224-227, 269-273, 275, 277-283, 286, 289, " +
      "292-294, 297, 300-302, 306-309, 344, 346, 348-350, 352-354, 356, 358-366",
    mixed:
      "8, 27, 32, 46, 109, 111, 116, 119-120, 124, 141, 143, 146, 156, 160-161, " +
      "190, 193, 206-207, 209, 222-223, 267-268, 274, 276, 284-285, 288, 290-291, " +
      "295-296, 310, 342-343, 345, 347, 351, 357",
    filler:
      "33, 50, 64-108, 128-137, 147-149, 168-189, 204-205, 213-214, 228-266, 287, " +
      "298-299, 303-305, 311-341, 355"
  };

  var LAST_EPISODE = 366;

  // Absolute number of the first episode of each Disney+ season, season 1 first.
  // Override this in the popup if Disney+ splits the seasons differently.
  var SEASON_STARTS = [1, 21, 42, 64, 92, 110, 132, 152, 168, 190, 206, 213, 230, 266, 292, 317];

  var LABELS = {
    canon: "Manga canon",
    mixed: "Mixed canon/filler",
    filler: "Filler",
    unknown: "Unknown"
  };

  var COLORS = {
    canon: "#30a46c",
    mixed: "#f5a524",
    filler: "#e5484d",
    unknown: "#8b8b94"
  };

  function parseRanges(text) {
    var out = [];
    var parts = text.split(",");
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!m) continue;
      out.push([Number(m[1]), Number(m[2] || m[1])]);
    }
    return out;
  }

  var STATUS = new Array(LAST_EPISODE + 1);
  for (var i = 0; i <= LAST_EPISODE; i++) STATUS[i] = "unknown";
  Object.keys(SOURCE).forEach(function (kind) {
    parseRanges(SOURCE[kind]).forEach(function (range) {
      for (var ep = range[0]; ep <= range[1]; ep++) {
        if (ep >= 1 && ep <= LAST_EPISODE) STATUS[ep] = kind;
      }
    });
  });

  function statusOf(abs) {
    if (!abs || abs < 1 || abs > LAST_EPISODE) return "unknown";
    return STATUS[abs];
  }

  // The unbroken stretch of same-status episodes that the given episode sits in.
  function runOf(abs) {
    var kind = statusOf(abs);
    if (kind === "unknown") return null;
    var start = abs;
    var end = abs;
    while (start > 1 && STATUS[start - 1] === kind) start--;
    while (end < LAST_EPISODE && STATUS[end + 1] === kind) end++;
    return { status: kind, start: start, end: end, length: end - start + 1 };
  }

  // The first run after the given episode whose status is one of kinds.
  function nextRun(abs, kinds) {
    for (var ep = (abs || 0) + 1; ep <= LAST_EPISODE; ep++) {
      if (kinds.indexOf(STATUS[ep]) !== -1) return runOf(ep);
    }
    return null;
  }

  // Disney+ counts episodes inside a season. The filler list counts them across
  // the whole show. This turns one into the other.
  function toAbsolute(season, episode, opts) {
    opts = opts || {};
    if (opts.absoluteNumbering) return episode;
    var starts = opts.seasonStarts || SEASON_STARTS;
    var base = starts[season - 1];
    if (typeof base !== "number" || !isFinite(base)) return null;
    return base + episode - 1;
  }

  scope.BLEACH = {
    LAST_EPISODE: LAST_EPISODE,
    SEASON_STARTS: SEASON_STARTS,
    LABELS: LABELS,
    COLORS: COLORS,
    STATUS: STATUS,
    statusOf: statusOf,
    runOf: runOf,
    nextRun: nextRun,
    toAbsolute: toAbsolute
  };
})(typeof self !== "undefined" ? self : window);
