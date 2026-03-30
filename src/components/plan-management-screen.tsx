"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { AuthRequired } from "@/components/auth-required";
import { useAuth } from "@/components/providers/auth-provider";
import { createSubscription, getCurrentSubscription, listPlans } from "@/lib/api";
import type { ActiveSubscriptionResponse, PlanResponse } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function PlanManagementScreen() {
  const { dashboard, loading, session, refreshDashboard } = useAuth();
  const [plans, setPlans] = useState<PlanResponse[]>([]);
  const [currentPlan, setCurrentPlan] = useState<ActiveSubscriptionResponse | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPlans().then(setPlans);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    getCurrentSubscription(session)
      .then(setCurrentPlan)
      .catch((nextError) =>
        setError(nextError instanceof Error ? nextError.message : "Unable to load plan")
      );
  }, [session]);

  async function handleSelectPlan(planCode: "FREE" | "PREMIUM") {
    if (!session || !dashboard?.user.id) {
      return;
    }
    setBusyPlan(planCode);
    setError(null);
    try {
      await createSubscription(session, dashboard.user.id, planCode);
      const refreshed = await getCurrentSubscription(session);
      setCurrentPlan(refreshed);
      await refreshDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update plan");
    } finally {
      setBusyPlan(null);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Plan management"
        eyebrow="Loading"
        description="Syncing active subscription and available plans."
      >
        <div className="empty-panel">Loading plan management...</div>
      </AppShell>
    );
  }

  if (!session || !dashboard) {
    return (
      <div className="page-shell" style={{ padding: "32px 0" }}>
        <AuthRequired
          title="Plan management is account-specific"
          description="Sign in to review your subscription and switch between free and premium."
        />
      </div>
    );
  }

  return (
    <AppShell
      title="Plan management"
      eyebrow="Subscription"
      description="Upgrade when you need multiple active listings, more intent visibility, or faster workflows."
    >
      {error ? (
        <div className="surface">
          <div className="hint" style={{ color: "#ffd3d8" }}>{error}</div>
        </div>
      ) : null}

      <div className="grid-two">
        <section className="surface">
          <div className="eyebrow">Current</div>
          <h2 className="section-title" style={{ fontSize: "2.4rem" }}>
            {currentPlan?.plan_name ?? dashboard.active_subscription.plan_name}
          </h2>
          <p className="section-copy" style={{ marginTop: 12 }}>
            {currentPlan?.plan_code === "PREMIUM"
              ? `Premium is active until ${formatDate(currentPlan.expires_at)}.`
              : "Free is active by default until you decide to upgrade."}
          </p>
        </section>

        <section className="surface">
          <div className="eyebrow">Why upgrade</div>
          <div className="list-panel">
            <div className="feature-card">
              <strong>Multiple active listings</strong>
            </div>
            <div className="feature-card">
              <strong>Direct like-backs and more visibility</strong>
            </div>
            <div className="feature-card">
              <strong>Priority support for active deals</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="grid-two">
        {plans.map((plan) => (
          <article className="plan-card" key={plan.id}>
            <div className="page-header" style={{ marginBottom: 10 }}>
              <div>
                <strong>{plan.name}</strong>
                <p className="section-copy" style={{ marginTop: 8 }}>{plan.description}</p>
              </div>
              <span className="mini-chip">₹{plan.price_inr}</span>
            </div>
            <div className="list-panel">
              <div className="feature-card">
                <strong>
                  {plan.can_create_multiple_listings ? "Multi listing" : "Single listing"}
                </strong>
              </div>
              <div className="feature-card">
                <strong>{plan.can_direct_like_back ? "Direct like-back" : "Mutual likes only"}</strong>
              </div>
              <div className="feature-card">
                <strong>{plan.can_see_who_liked ? "See incoming likes" : "Incoming likes stay hidden"}</strong>
              </div>
            </div>
            <div className="action-row" style={{ marginTop: 18 }}>
              <button
                className={`primary-button ${
                  currentPlan?.plan_code === plan.code ? "" : ""
                }`}
                disabled={busyPlan === plan.code}
                onClick={() => void handleSelectPlan(plan.code)}
                type="button"
              >
                {busyPlan === plan.code
                  ? "Updating..."
                  : currentPlan?.plan_code === plan.code
                    ? "Current plan"
                    : `Switch to ${plan.name}`}
              </button>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
