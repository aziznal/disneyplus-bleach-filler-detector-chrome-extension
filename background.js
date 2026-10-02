// Puts a letter on the toolbar icon for the tab that reported a status:
// F for filler, M for mixed, C for canon.
"use strict";

var BADGE = {
  filler: ["F", "#e5484d"],
  mixed: ["M", "#f5a524"],
  canon: ["C", "#30a46c"]
};

chrome.runtime.onMessage.addListener(function (msg, sender) {
  if (!msg || msg.type !== "bleach-status" || !sender.tab) return;
  var tabId = sender.tab.id;
  var entry = BADGE[msg.status];
  chrome.action.setBadgeText({ tabId: tabId, text: entry ? entry[0] : "" });
  if (entry) {
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: entry[1] });
    chrome.action.setBadgeTextColor({ tabId: tabId, color: "#ffffff" });
  }
});
