"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/providers/auth-provider";
import {
  confirmAccountDelete,
  requestAccountDeleteOtp,
  updateMe,
} from "@/lib/api";

export function SettingsScreen() {
  const { dashboard, loading, logout, refreshDashboard, session } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteOtpHint, setDeleteOtpHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasTenantAccess =
    Boolean(dashboard?.roles.includes("TENANT")) || dashboard?.user.default_role === "TENANT";
  const hasListerAccess =
    Boolean(dashboard?.roles.includes("OWNER")) ||
    Boolean(dashboard?.roles.includes("BROKER")) ||
    dashboard?.user.default_role === "OWNER" ||
    dashboard?.user.default_role === "BROKER";

  const accountFamilyLabel = useMemo(() => {
    if (hasTenantAccess && !hasListerAccess) {
      return "Tenant";
    }
    if (!hasTenantAccess && hasListerAccess) {
      return "Property lister";
    }
    if (hasTenantAccess && hasListerAccess) {
      return "Mixed access";
    }
    return "Account";
  }, [hasListerAccess, hasTenantAccess]);

  useEffect(() => {
    if (!dashboard) {
      return;
    }
    setFullName(dashboard.user.full_name ?? "");
    setEmail(dashboard.user.email ?? "");
  }, [dashboard]);

  async function handleSaveDetails() {
    if (!session) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updateMe(session, {
        full_name: fullName.trim(),
        email: email.trim() || null,
      });
      await refreshDashboard();
      setStatus("Account details updated.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update settings");
    } finally {
      setPending(false);
    }
  }

  async function handleRequestDeleteOtp() {
    if (!session) {
      return;
    }
    setDeletePending(true);
    setError(null);
    try {
      const response = await requestAccountDeleteOtp(session);
      setDeleteOtpHint(response.dev_otp ?? null);
      setStatus("Deletion OTP sent. Confirm below to hide this account.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to request deletion OTP");
    } finally {
      setDeletePending(false);
    }
  }

  async function handleDeleteAccount() {
    if (!session || !deleteOtp.trim()) {
      return;
    }
    setDeletePending(true);
    setError(null);
    try {
      await confirmAccountDelete(session, deleteOtp.trim());
      await logout();
      window.location.href = "/";
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete account");
    } finally {
      setDeletePending(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Settings"
        eyebrow="Loading"
        description="Loading account controls and session state."
        showHero={false}
      >
        <div className="empty-panel">Loading settings...</div>
      </AppShell>
    );
  }

  if (!session || !dashboard) {
    return null;
  }

  return (
    <AppShell
      title="Settings"
      eyebrow="Account management"
      description="Manage your identity details, understand persona rules, and hide your account securely with OTP."
      showHero={false}
    >
      {status ? (
        <div className="surface">
          <div className="hint">{status}</div>
        </div>
      ) : null}
      {error ? (
        <div className="surface">
          <div className="hint" style={{ color: "#ffd3d8" }}>{error}</div>
        </div>
      ) : null}

      <section className="surface">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <strong>Account details</strong>
            <p className="section-copy" style={{ marginTop: 8 }}>
              Update your name and email here. Phone number stays tied to OTP login.
            </p>
          </div>
        </div>
        <div className="field-grid">
          <div className="form-field">
            <label>Full name</label>
            <input
              className="input"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Phone</label>
            <input className="input" disabled value={dashboard.user.phone_e164} />
          </div>
          <div className="form-field">
            <label>Account family</label>
            <input className="input" disabled value={accountFamilyLabel} />
          </div>
        </div>
        <div className="action-row" style={{ marginTop: 16 }}>
          <button className="primary-button" disabled={pending} onClick={() => void handleSaveDetails()} type="button">
            {pending ? "Saving..." : "Save settings"}
          </button>
        </div>
      </section>

      <section className="surface">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <strong>Persona management</strong>
            <p className="section-copy" style={{ marginTop: 8 }}>
              Tenant and property-lister personas stay isolated. To switch between them, hide this account with OTP and sign up again using the same number.
            </p>
          </div>
        </div>
        <div className="inline-meta" style={{ marginBottom: 16 }}>
          {dashboard.roles.map((role) => (
            <span className="mini-chip" key={role}>{role.toLowerCase()}</span>
          ))}
        </div>
        <div className="grid-two">
          {hasTenantAccess ? (
            <Link className="soft-button" href="/profile">
              Manage tenant profile
            </Link>
          ) : null}
          {hasListerAccess ? (
            <Link className="soft-button" href="/properties">
              Manage properties
            </Link>
          ) : null}
        </div>
      </section>

      <section className="surface">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <strong>Danger zone</strong>
            <p className="section-copy" style={{ marginTop: 8 }}>
              Deleting the account hides the current persona and blocks access to that hidden profile forever, even if you later sign up again with the same number.
            </p>
          </div>
        </div>
        <div className="field-stack">
          <button
            className="danger-button"
            disabled={deletePending}
            onClick={() => void handleRequestDeleteOtp()}
            type="button"
          >
            {deletePending ? "Sending OTP..." : "Send deletion OTP"}
          </button>
          <div className="form-field">
            <label>Confirm deletion OTP</label>
            <input
              className="input"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 digit OTP"
              value={deleteOtp}
              onChange={(event) => setDeleteOtp(event.target.value)}
            />
            {deleteOtpHint ? (
              <div className="hint">
                Dev OTP: <strong>{deleteOtpHint}</strong>
              </div>
            ) : null}
          </div>
          <button
            className="danger-button"
            disabled={deletePending || !deleteOtp.trim()}
            onClick={() => void handleDeleteAccount()}
            type="button"
          >
            {deletePending ? "Deleting..." : "Delete account and hide persona"}
          </button>
        </div>
      </section>
    </AppShell>
  );
}
