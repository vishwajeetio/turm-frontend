"use client";

export function AppLoaderOverlay({
  message = "Loading your next screen..."
}: {
  message?: string;
}) {
  return (
    <div aria-live="polite" aria-modal="true" className="app-loader-overlay" role="alertdialog">
      <div className="app-loader-panel">
        <div className="app-loader-mark-wrap">
          <img alt="Turm" className="app-loader-mark" src="/brand-mark.svg" />
          <span className="app-loader-orbit app-loader-orbit-one" />
          <span className="app-loader-orbit app-loader-orbit-two" />
        </div>
        <div className="app-loader-copy">
          <strong>Turm</strong>
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}
