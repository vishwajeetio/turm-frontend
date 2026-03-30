"use client";

import { useAuth } from "@/components/providers/auth-provider";

export function AuthRequired({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  const { setAuthOpen } = useAuth();
  return (
    <div className="empty-panel">
      <div className="eyebrow">Members Only</div>
      <h2 className="section-title">{title}</h2>
      <p className="section-copy" style={{ marginTop: 10 }}>
        {description}
      </p>
      <div className="action-row" style={{ justifyContent: "center", marginTop: 18 }}>
        <button className="primary-button" onClick={() => setAuthOpen(true)} type="button">
          Sign in with phone
        </button>
      </div>
    </div>
  );
}
