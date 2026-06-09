void import(chrome.runtime.getURL("src/content-view.js")).then(
  ({ projectSnapshot }) => {
    const hostId = "social-network-daily-timer";
    const maxLocalGapMs = 60_000;
    let snapshot = null;

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

        .timer {
          box-sizing: border-box;
          min-width: 280px;
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
          font-size: clamp(38px, 5vw, 64px);
          font-variant-numeric: tabular-nums;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.04em;
          text-align: center;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.72);
        }
      </style>
      <div class="timer" role="timer" aria-live="off">00:00:00</div>
    `;
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
      if (!host.isConnected) {
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

    ensureMounted();
    new MutationObserver(ensureMounted).observe(document.documentElement, {
      childList: true,
    });
    window.setInterval(render, 1_000);
    window.setInterval(requestSnapshot, 30_000);
    void requestSnapshot();
  },
);
