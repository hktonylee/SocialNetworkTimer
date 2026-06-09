void import(chrome.runtime.getURL("src/content-view.js")).then(
  ({
    collapseUntil,
    getDelayToNextWallClockSecond,
    isPanelHidden,
    projectSnapshot,
  }) => {
    const hostId = "social-network-daily-timer";
    const collapseStorageKey = "socialTimerCollapsedUntil";
    const maxLocalGapMs = 60_000;
    let snapshot = null;
    let showTimer;

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
          font-family: "Trebuchet MS", sans-serif;
          font-size: 25px;
          font-weight: 800;
          line-height: 40px;
          text-align: center;
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
      <button class="collapse" type="button" aria-label="Hide timer for one minute">⌄</button>
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
      timer.textContent = projectSnapshot(snapshot, {
        nowMs,
        dateKey: localDateKey(nowMs),
        maxLocalGapMs,
      });
    }

    async function requestSnapshot() {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "SOCIAL_TIMER_GET_SNAPSHOT",
        });
        if (response?.type === "SOCIAL_TIMER_SNAPSHOT") {
          snapshot = response;
          render();
        }
      } catch {
        // Service worker may be restarting. Next interval or visibility event retries.
      }
    }

    function ensureMounted() {
      const nowMs = Date.now();
      const hidden = isPanelHidden(
        sessionStorage.getItem(collapseStorageKey),
        nowMs,
      );
      if (hidden) {
        host.remove();
        const expiryMs = Number(sessionStorage.getItem(collapseStorageKey));
        window.clearTimeout(showTimer);
        showTimer = window.setTimeout(ensureMounted, expiryMs - nowMs);
      } else if (!host.isConnected) {
        sessionStorage.removeItem(collapseStorageKey);
        document.documentElement.append(host);
      }
    }

    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === "SOCIAL_TIMER_SNAPSHOT") {
        snapshot = message;
        render();
      }
    });
    document.addEventListener("visibilitychange", () => {
      ensureMounted();
      void requestSnapshot();
    });
    collapseButton.addEventListener("click", () => {
      const expiryMs = collapseUntil(Date.now());
      sessionStorage.setItem(collapseStorageKey, String(expiryMs));
      ensureMounted();
    });

    ensureMounted();
    new MutationObserver(ensureMounted).observe(document.documentElement, {
      childList: true,
    });
    window.setTimeout(() => {
      render();
      window.setInterval(render, 1_000);
    }, getDelayToNextWallClockSecond());
    window.setInterval(requestSnapshot, 30_000);
    void requestSnapshot();
  },
);
