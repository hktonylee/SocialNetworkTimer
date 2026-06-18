import { createBackgroundController } from "./background-controller.js";
import {
  enabledSocialSitesStorageKey,
  getLocalDateKey,
  isSupportedUrl,
  normalizeEnabledSiteIds,
} from "./timer.js";

const storageKey = "dailySocialTimerIntervals";
const alarmName = "social-timer-sync";
const alarmPeriodMinutes = 0.5;

async function getEnabledSiteIds() {
  const stored = await chrome.storage.local.get(enabledSocialSitesStorageKey);
  return normalizeEnabledSiteIds(stored[enabledSocialSitesStorageKey]);
}

async function getShouldCount() {
  const window = await chrome.windows.getLastFocused();
  if (!window.focused || window.id === chrome.windows.WINDOW_ID_NONE) {
    return false;
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    windowId: window.id,
  });
  return isSupportedUrl(activeTab?.url, await getEnabledSiteIds());
}

async function getShouldCountForSender(sender) {
  const senderTab = sender?.tab;
  if (
    senderTab?.id === undefined ||
    senderTab.windowId === undefined ||
    senderTab.windowId === chrome.windows.WINDOW_ID_NONE
  ) {
    return getShouldCount();
  }

  const [window, currentTab, enabledSiteIds] = await Promise.all([
    chrome.windows.get(senderTab.windowId),
    chrome.tabs.get(senderTab.id).catch(() => senderTab),
    getEnabledSiteIds(),
  ]);
  if (!window.focused) {
    return false;
  }

  return (
    currentTab.active === true &&
    isSupportedUrl(currentTab.url ?? senderTab.url, enabledSiteIds)
  );
}

async function broadcast(snapshot) {
  const [tabs, enabledSiteIds] = await Promise.all([
    chrome.tabs.query({}),
    getEnabledSiteIds(),
  ]);
  await Promise.allSettled(
    tabs
      .filter(
        (tab) => tab.id !== undefined && isSupportedUrl(tab.url, enabledSiteIds),
      )
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
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName === "local" &&
    changes[enabledSocialSitesStorageKey] !== undefined
  ) {
    void sync();
  }
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === alarmName) {
    void sync();
  }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SOCIAL_TIMER_SYNC") {
    return false;
  }

  getShouldCountForSender(sender)
    .then((shouldCount) => controller.getSnapshot({ shouldCount }))
    .then(sendResponse)
    .catch(() => sendResponse(null));
  return true;
});

void sync();
