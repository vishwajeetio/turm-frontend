"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const PROMPT_MINIMIZED_KEY = "turm.mobile.install.minimized";
const PROMPT_DISMISSED_KEY = "turm.mobile.install.dismissed";
const PROMPT_SEEN_KEY = "turm.mobile.install.seen";

function isMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function AppExperiencePrompt() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [mediaStatus, setMediaStatus] = useState<"idle" | "granted" | "denied">("idle");

  const iosInstallHint = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    const userAgent = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios/.test(userAgent);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if ("Notification" in window) {
      setNotificationStatus(window.Notification.permission);
    } else {
      setNotificationStatus("unsupported");
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore local registration issues and keep the app usable.
      });
    }

    const mobile = isMobileDevice();
    const standalone = isStandaloneDisplay();
    const dismissed = window.localStorage.getItem(PROMPT_DISMISSED_KEY) === "true";
    const isMinimized = window.localStorage.getItem(PROMPT_MINIMIZED_KEY) === "true";
    const seen = window.localStorage.getItem(PROMPT_SEEN_KEY) === "true";

    setReady(true);
    setMinimized(isMinimized || (mobile && !standalone && !dismissed && seen));
    setVisible(mobile && !standalone && !dismissed && !isMinimized && !seen);
    if (mobile && !standalone && !dismissed && !seen) {
      window.localStorage.setItem(PROMPT_SEEN_KEY, "true");
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as DeferredInstallPrompt);
      if (mobile && !standalone && !dismissed) {
        setVisible(true);
        setMinimized(false);
        window.localStorage.removeItem(PROMPT_MINIMIZED_KEY);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotificationStatus("unsupported");
      return;
    }
    const permission = await window.Notification.requestPermission();
    setNotificationStatus(permission);
  }

  async function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationStatus("granted"),
      () => setLocationStatus("denied"),
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 60_000,
      }
    );
  }

  async function requestMediaAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaStatus("denied");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMediaStatus("granted");
    } catch {
      setMediaStatus("denied");
    }
  }

  async function handleInstall() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        window.localStorage.setItem(PROMPT_DISMISSED_KEY, "true");
        setVisible(false);
        setMinimized(false);
      } else {
        minimizePrompt();
      }
      return;
    }
    setVisible(true);
  }

  function minimizePrompt() {
    window.localStorage.setItem(PROMPT_MINIMIZED_KEY, "true");
    setMinimized(true);
    setVisible(false);
  }

  if (!ready || !isMobileDevice() || isStandaloneDisplay()) {
    return null;
  }

  return (
    <>
      {visible ? (
        <div className="experience-prompt-backdrop" onClick={minimizePrompt}>
          <section
            className="experience-prompt-card"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div className="experience-prompt-brand">
                <span className="experience-prompt-logo">
                  <Image alt="Turm" height={56} priority src="/brand-mark.svg" width={56} />
                </span>
                <div>
                  <strong>Install Turm</strong>
                  <p className="section-copy" style={{ marginTop: 6 }}>
                    Add Turm to your home screen for a more native feel, smoother notifications,
                    camera uploads, and location-based matching.
                  </p>
                </div>
              </div>
              <button className="ghost-button" onClick={minimizePrompt} type="button">
                Minimize
              </button>
            </header>

            <div className="experience-prompt-grid">
              <article>
                <strong>Install app</strong>
                <p>
                  {installPrompt
                    ? "Use the install button below to add Turm to your home screen."
                    : iosInstallHint
                      ? "On iPhone or iPad, open Share and choose Add to Home Screen."
                      : "Install becomes available when your browser exposes the app prompt."}
                </p>
                <button className="soft-button" onClick={() => void handleInstall()} type="button">
                  {installPrompt ? "Install now" : iosInstallHint ? "Show iPhone steps" : "Keep open"}
                </button>
              </article>

              <article>
                <strong>Notifications</strong>
                <p>Status: {notificationStatus === "unsupported" ? "Unavailable" : notificationStatus}</p>
                <button className="soft-button" onClick={() => void requestNotifications()} type="button">
                  Enable notifications
                </button>
              </article>

              <article>
                <strong>Location</strong>
                <p>Status: {locationStatus}</p>
                <button className="soft-button" onClick={() => void requestLocation()} type="button">
                  Allow location
                </button>
              </article>

              <article>
                <strong>Media access</strong>
                <p>Status: {mediaStatus}</p>
                <button className="soft-button" onClick={() => void requestMediaAccess()} type="button">
                  Allow media
                </button>
              </article>
            </div>
          </section>
        </div>
      ) : null}

      {minimized ? (
        <button
          className="experience-prompt-chip"
          onClick={() => {
            setVisible(true);
            setMinimized(false);
            window.localStorage.removeItem(PROMPT_MINIMIZED_KEY);
          }}
          type="button"
        >
          Install Turm
        </button>
      ) : null}
    </>
  );
}
