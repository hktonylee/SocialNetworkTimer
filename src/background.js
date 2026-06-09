import { createBackgroundController } from "./background-controller.js";
import { getLocalDateKey, isSupportedUrl } from "./timer.js";

const storageKey = "dailySocialTimerState";
const alarmName = "social-timer-reconcile";
const alarmPeriodMinutes = 0.5;
const maxGapMs = alarmPeriodMinutes * 2 * 60_000;

async function getShouldCount() {
  const window = await chrome.windows.getLastFocused();
  if (!window.focused || window.id === chrome.windows.WINDOW_ID_NONE) {
    return false;
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    windowId: window.id,
  });
  return isSupportedUrl(activeTab?.url);
}

async function broadcast(snapshot) {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs
      .filter((tab) => tab.id !== undefined && isSupportedUrl(tab.url))
      .map((tab) => chrome.tabs.sendMessage(tab.id, snapshot)),
  );
}

const controller = createBackgroundController({
  storage: {
    async read() {
      const stored = await chrome.storage.local.get(storageKey);
      return stored[storageKey];
    },
    async write(state) {
      await chrome.storage.local.set({ [storageKey]: state });
    },
  },
  getShouldCount,
  broadcast,
  now: Date.now,
  getDateKey: getLocalDateKey,
  maxGapMs,
});

function reconcile() {
  return controller.reconcile().catch((error) => {
    console.error("Social timer reconciliation failed", error);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(alarmName, { periodInMinutes: alarmPeriodMinutes });
  void reconcile();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(alarmName, { periodInMinutes: alarmPeriodMinutes });
  void reconcile();
});
chrome.tabs.onActivated.addListener(reconcile);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url !== undefined || changeInfo.status === "complete") {
    void reconcile();
  }
});
chrome.tabs.onRemoved.addListener(reconcile);
chrome.windows.onFocusChanged.addListener(reconcile);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === alarmName) {
    void reconcile();
  }
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SOCIAL_TIMER_GET_SNAPSHOT") {
    return false;
  }

  controller.getSnapshot().then(sendResponse).catch(() => sendResponse(null));
  return true;
});

void reconcile();
