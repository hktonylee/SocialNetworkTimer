import {
  enabledSocialSitesStorageKey,
  normalizeEnabledSiteIds,
  socialSites,
} from "./timer.js";

const siteList = document.querySelector("#site-list");

function orderEnabledSiteIds(enabledSiteIds) {
  const enabled = new Set(enabledSiteIds);
  return socialSites.filter((site) => enabled.has(site.id)).map((site) => site.id);
}

async function saveEnabledSiteIds(enabledSiteIds) {
  await chrome.storage.local.set({
    [enabledSocialSitesStorageKey]: orderEnabledSiteIds(enabledSiteIds),
  });
}

function createSiteToggle(site, enabledSiteIds) {
  const item = document.createElement("li");
  item.className = "site";

  const name = document.createElement("span");
  name.className = "site-name";
  name.textContent = site.label;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = enabledSiteIds.has(site.id);
  checkbox.setAttribute("aria-label", site.label);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      enabledSiteIds.add(site.id);
    } else {
      enabledSiteIds.delete(site.id);
    }

    void saveEnabledSiteIds([...enabledSiteIds]);
  });

  item.append(name, checkbox);
  return item;
}

async function render() {
  const stored = await chrome.storage.local.get(enabledSocialSitesStorageKey);
  const enabledSiteIds = new Set(
    normalizeEnabledSiteIds(stored[enabledSocialSitesStorageKey]),
  );

  siteList.replaceChildren(
    ...socialSites.map((site) => createSiteToggle(site, enabledSiteIds)),
  );
}

void render();
