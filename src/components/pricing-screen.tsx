"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { listPlans } from "@/lib/api";
import type { PlanResponse } from "@/lib/types";

export function PricingScreen() {
  const { setAuthOpen } = useAuth();
  const [plans, setPlans] = useState<PlanResponse[]>([]);

  useEffect(() => {
    void listPlans().then(setPlans);
  }, []);

  return (
    <AppShell
      title="Pricing"
      eyebrow="Free vs premium"
      description="Two plans, clear tradeoffs, and premium controls for faster matching and multi-listing management."
      actions={
        <button className="primary-button" onClick={() => setAuthOpen(true)} type="button">
          Start with OTP
        </button>
      }
    >
      <div className="grid-two">
        {plans.map((plan) => (
          <article className="plan-card" key={plan.id}>
            <div className="eyebrow">{plan.code.toLowerCase()}</div>
            <h2 className="section-title" style={{ fontSize: "2.4rem", marginTop: 0 }}>
              {plan.name}
            </h2>
            <p className="section-copy" style={{ marginTop: 10 }}>{plan.description}</p>
            <strong className="stat-number" style={{ marginTop: 18 }}>
              ₹{plan.price_inr}
            </strong>
            <div className="list-panel" style={{ marginTop: 18 }}>
              <div className="feature-card">
                <strong>{plan.can_create_multiple_listings ? "Multiple active listings" : "Single active listing"}</strong>
              </div>
              <div className="feature-card">
                <strong>
                  {plan.daily_like_limit === null
                    ? "Unlimited daily likes"
                    : `${plan.daily_like_limit} daily likes`}
                </strong>
              </div>
              <div className="feature-card">
                <strong>{plan.can_direct_like_back ? "Direct like-back enabled" : "Mutual flow only"}</strong>
              </div>
              <div className="feature-card">
                <strong>{plan.can_see_who_liked ? "See incoming likes" : "Likes unlock on match"}</strong>
              </div>
              <div className="feature-card">
                <strong>{plan.can_rewind ? "Rewind swipes included" : "No rewind"}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
