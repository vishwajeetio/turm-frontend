"use client";

import { AuthFlowCard } from "@/components/auth-flow-card";
import { useAuth } from "@/components/providers/auth-provider";

export function AuthSheet() {
  const { authOpen, setAuthOpen } = useAuth();

  if (!authOpen) {
    return null;
  }

  return (
    <div className="auth-backdrop" onClick={() => setAuthOpen(false)}>
      <div onClick={(event) => event.stopPropagation()}>
        <AuthFlowCard onClose={() => setAuthOpen(false)} showHomeLink={false} />
      </div>
    </div>
  );
}
