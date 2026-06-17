import { createBackgroundController } from "./background-controller.js";
import { getLocalDateKey, isSupportedUrl } from "./timer.js";

const storageKey = "dailySocialTimerIntervals";
const alarmName = "social-timer-sync";
const alarmPeriodMinutes = 0.5;

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
});

function sync() {
  return controller.sync().catch((error) => {
    console.error("Social timer synchronization failed", error);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(alarmName, { periodInMinutes: alarmPeriodMinutes });
  void sync();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(alarmName, { periodInMinutes: alarmPeriodMinutes });
  void sync();
});
chrome.tabs.onActivated.addListener(sync);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url !== undefined || changeInfo.status === "complete") {
    void sync();
  }
});
chrome.tabs.onRemoved.addListener(sync);
chrome.windows.onFocusChanged.addListener(sync);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === alarmName) {
    void sync();
  }
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SOCIAL_TIMER_SYNC") {
    return false;
  }

  controller.getSnapshot().then(sendResponse).catch(() => sendResponse(null));
  return true;
});

void sync();
