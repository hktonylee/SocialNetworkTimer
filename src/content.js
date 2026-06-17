void Promise.all([
  import(chrome.runtime.getURL("src/content-view.js")),
  import(chrome.runtime.getURL("src/timer.js")),
]).then(
  ([
    {
      collapseUntil,
      getDelayToNextWallClockSecond,
      isPanelHidden,
      projectDayState,
      shouldRetryDayResponse,
    },
    {
      enabledSocialSitesStorageKey,
      isSupportedUrl,
      normalizeEnabledSiteIds,
    },
  ]) => {
    const hostId = "social-network-daily-timer";
    const syncRetryDelayMs = 1_000;
    let dayState = null;
    let syncRetryTimer;
    let showTimer;
    let collapsedUntilMs = 0;
    let siteEnabled = false;

    const host = document.createElement("div");
    host.id = hostId;
    host.setAttribute("aria-label", "Daily social media time");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          position: fixed;
          z-index: 2147483647;
          left: 50%;
          bottom: 0;
          transform: translateX(-50%);
          pointer-events: none;
        }

        .collapse {
          position: absolute;
          z-index: 1;
          left: 50%;
          top: 0;
          width: 44px;
          height: 44px;
          padding: 0;
          transform: translate(-50%, -50%);
          pointer-events: auto;
          cursor: pointer;
          color: #7c1827;
          background: rgba(247, 247, 245, 0.94);
          border: 1px solid rgba(255, 255, 255, 0.96);
          border-radius: 50%;
          box-shadow:
            0 5px 16px rgba(31, 38, 45, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.94);
          text-align: center;
        }

        .collapse-icon {
          display: block;
          width: 18px;
          height: 18px;
          margin: auto;
          fill: currentColor;
        }

        .collapse:hover {
          background: rgba(255, 255, 255, 0.98);
          color: #c80f25;
        }

        .collapse:focus-visible {
          outline: 3px solid rgba(200, 15, 37, 0.5);
          outline-offset: 3px;
        }

        .timer {
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 280px;
          min-height: 20vh;
          padding: 13px 30px calc(10px + env(safe-area-inset-bottom, 0px));
          overflow: hidden;
          color: #c80f25;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(226, 229, 232, 0.72));
          border: 1px solid rgba(255, 255, 255, 0.88);
          border-bottom: 0;
          border-radius: 24px 24px 0 0;
          box-shadow:
            0 -8px 30px rgba(31, 38, 45, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(18px) saturate(145%);
          -webkit-backdrop-filter: blur(18px) saturate(145%);
          font-family: "Arial Rounded MT Bold", "Trebuchet MS", sans-serif;
          font-size: clamp(64px, 12vh, 140px);
          font-variant-numeric: tabular-nums;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.04em;
          text-align: center;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.72);
        }
      </style>
      <button class="collapse" type="button" aria-label="Hide timer for one minute">
        <svg class="collapse-icon" aria-hidden="true" focusable="false" viewBox="0 0 320 512" xmlns="http://www.w3.org/2000/svg">
          <path d="M143 256.3 7 120.3c-9.4-9.4-9.4-24.6 0-33.9l22.6-22.6c9.4-9.4 24.6-9.4 33.9 0l96.4 96.4 96.4-96.4c9.4-9.4 24.6-9.4 33.9 0l22.6 22.6c9.4 9.4 9.4 24.6 0 33.9l-136 136c-9.2 9.4-24.4 9.4-33.8 0zm34 192 136-136c9.4-9.4 9.4-24.6 0-33.9l-22.6-22.6c-9.4-9.4-24.6-9.4-33.9 0L160 352.2l-96.4-96.4c-9.4-9.4-24.6-9.4-33.9 0L7 278.3c-9.4 9.4-9.4 24.6 0 33.9l136 136c9.3 9.5 24.5 9.5 34 .1z" />
        </svg>
      </button>
      <div class="timer" role="timer" aria-live="off">00:00:00</div>
    `;
    const collapseButton = shadow.querySelector(".collapse");
    const timer = shadow.querySelector(".timer");

    function localDateKey(nowMs) {
      const date = new Date(nowMs);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function render() {
      const nowMs = Date.now();
      timer.textContent = projectDayState(dayState, {
        nowMs,
        dateKey: localDateKey(nowMs),
      });
    }

    function clearSyncRetry() {
      window.clearTimeout(syncRetryTimer);
      syncRetryTimer = undefined;
    }

    function scheduleSyncRetry() {
      window.clearTimeout(syncRetryTimer);
      syncRetryTimer = window.setTimeout(requestSync, syncRetryDelayMs);
    }

    async function requestSync() {
      if (!siteEnabled) {
        return;
      }

      try {
        const response = await chrome.runtime.sendMessage({
          type: "SOCIAL_TIMER_SYNC",
        });

        if (shouldRetryDayResponse(response)) {
          scheduleSyncRetry();
          return;
        }

        dayState = response;
        clearSyncRetry();
        render();
      } catch {
        scheduleSyncRetry();
      }
    }

    function ensureMounted() {
      if (!siteEnabled) {
        host.remove();
        window.clearTimeout(showTimer);
        return;
      }

      const nowMs = Date.now();
      const hidden = isPanelHidden(String(collapsedUntilMs), nowMs);
      if (hidden) {
        host.remove();
        window.clearTimeout(showTimer);
        showTimer = window.setTimeout(ensureMounted, collapsedUntilMs - nowMs);
      } else if (!host.isConnected) {
        collapsedUntilMs = 0;
        document.documentElement.append(host);
      }
    }

    async function refreshSiteEnabled() {
      const stored = await chrome.storage.local.get(enabledSocialSitesStorageKey);
      const enabledSiteIds = normalizeEnabledSiteIds(
        stored[enabledSocialSitesStorageKey],
      );
      siteEnabled = isSupportedUrl(window.location.href, enabledSiteIds);
      ensureMounted();
      if (siteEnabled) {
        void requestSync();
      } else {
        clearSyncRetry();
      }
    }

    chrome.runtime.onMessage.addListener((message) => {
      if (!siteEnabled) {
        return;
      }

      if (!shouldRetryDayResponse(message)) {
        dayState = message;
        clearSyncRetry();
        render();
      }
    });
    document.addEventListener("visibilitychange", () => {
      ensureMounted();
      void requestSync();
    });
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (
        areaName === "local" &&
        changes[enabledSocialSitesStorageKey] !== undefined
      ) {
        void refreshSiteEnabled();
      }
    });
    collapseButton.addEventListener("click", () => {
      collapsedUntilMs = collapseUntil(Date.now());
      ensureMounted();
    });

    new MutationObserver(ensureMounted).observe(document.documentElement, {
      childList: true,
    });
    window.setTimeout(() => {
      render();
      window.setInterval(render, 1_000);
    }, getDelayToNextWallClockSecond());
    window.setInterval(requestSync, 30_000);
    void refreshSiteEnabled();
  },
);
