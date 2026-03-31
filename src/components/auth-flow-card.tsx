"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import type { RoleType } from "@/lib/types";

type AuthFlowStep = "phone" | "otp" | "details";

function normalizeNextPath(nextPath: string | null | undefined) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }
  return nextPath;
}

export function AuthFlowCard({
  nextPath,
  onClose,
  onSuccess,
  showHomeLink = true,
}: {
  nextPath?: string | null;
  onClose?: () => void;
  onSuccess?: () => void;
  showHomeLink?: boolean;
}) {
  const {
    completeSignup,
    lastOtpHint,
    requestOtp,
    verifyOtp,
  } = useAuth();
  const router = useRouter();

  const [phoneNumber, setPhoneNumber] = useState("+91");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [defaultRole, setDefaultRole] = useState<RoleType>("TENANT");
  const [step, setStep] = useState<AuthFlowStep>("phone");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingToken, setOnboardingToken] = useState<string | null>(null);

  const resolvedNextPath = useMemo(() => normalizeNextPath(nextPath), [nextPath]);

  function finishFlow() {
    onSuccess?.();
    if (typeof window !== "undefined") {
      window.location.assign(resolvedNextPath);
      return;
    }
    router.push(resolvedNextPath);
    router.refresh();
  }

  async function handleRequestOtp(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await requestOtp(phoneNumber);
      setOtp("");
      setOnboardingToken(null);
      setStep("otp");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to send OTP");
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await verifyOtp({
        phoneNumber,
        otp,
      });
      if (result.onboardingRequired) {
        setOnboardingToken(result.onboardingToken ?? null);
        setStep("details");
        return;
      }
      finishFlow();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to verify OTP");
    } finally {
      setPending(false);
    }
  }

  async function handleCompleteSignup(event: FormEvent) {
    event.preventDefault();
    if (!onboardingToken) {
      setError("This signup session expired. Please request a fresh OTP.");
      setStep("phone");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await completeSignup({
        onboardingToken,
        fullName,
        email,
        defaultRole,
      });
      finishFlow();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to finish signup");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-sheet-card auth-flow-card">
      <div className="dashboard-brand">
        <div className="logo-tile">
          <Image src="/brand-mark.svg" alt="Turm" width={56} height={56} />
        </div>
        <div>
          <strong>Turm Access</strong>
          <span>Phone-first sign in for tenants, owners, and brokers.</span>
        </div>
      </div>

      <div className="auth-flow-step-row">
        <span className={`auth-flow-step-pill ${step === "phone" ? "is-active" : ""}`}>Number</span>
        <span className={`auth-flow-step-pill ${step === "otp" ? "is-active" : ""}`}>Verify</span>
        <span className={`auth-flow-step-pill ${step === "details" ? "is-active" : ""}`}>Profile</span>
      </div>

      {step === "phone" ? (
        <form className="field-stack" onSubmit={handleRequestOtp}>
          <div className="form-field">
            <label htmlFor="auth-phone">Indian mobile number</label>
            <input
              id="auth-phone"
              className="input"
              placeholder="+919876543210"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
            <div className="hint">We use OTP login and keep the long-lived session in an HTTP-only cookie.</div>
          </div>
          {error ? <div className="hint" style={{ color: "#ffd3d8" }}>{error}</div> : null}
          <div className="action-row">
            <button className="primary-button" disabled={pending} type="submit">
              {pending ? "Sending OTP..." : "Send OTP"}
            </button>
            {onClose ? (
              <button className="ghost-button" onClick={onClose} type="button">
                Close
              </button>
            ) : showHomeLink ? (
              <Link className="ghost-button" href="/">
                Back home
              </Link>
            ) : null}
          </div>
        </form>
      ) : null}

      {step === "otp" ? (
        <form className="field-stack" onSubmit={handleVerifyOtp}>
          <div className="form-field">
            <label htmlFor="auth-otp">OTP</label>
            <input
              id="auth-otp"
              className="input"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 digit code"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
            />
            {lastOtpHint ? (
              <div className="hint">Dev OTP: <strong>{lastOtpHint}</strong></div>
            ) : null}
          </div>
          <div className="hint">
            Existing accounts enter immediately after verification. New numbers continue to the setup step.
          </div>
          {error ? <div className="hint" style={{ color: "#ffd3d8" }}>{error}</div> : null}
          <div className="action-row">
            <button className="primary-button" disabled={pending} type="submit">
              {pending ? "Verifying..." : "Verify OTP"}
            </button>
            <button className="ghost-button" onClick={() => setStep("phone")} type="button">
              Back
            </button>
          </div>
        </form>
      ) : null}

      {step === "details" ? (
        <form className="field-stack" onSubmit={handleCompleteSignup}>
          <div className="field-grid">
            <div className="form-field">
              <label htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                className="input"
                placeholder="Your full name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                className="input"
                placeholder="you@example.com"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="auth-role">Starting role</label>
            <select
              id="auth-role"
              className="select"
              value={defaultRole}
              onChange={(event) => setDefaultRole(event.target.value as RoleType)}
            >
              <option value="TENANT">Tenant</option>
              <option value="OWNER">Owner</option>
              <option value="BROKER">Broker</option>
            </select>
            <div className="hint">
              Tenant accounts and property-lister accounts stay separate. Switching between them still requires account deletion with OTP.
            </div>
          </div>

          {error ? <div className="hint" style={{ color: "#ffd3d8" }}>{error}</div> : null}
          <div className="action-row">
            <button className="primary-button" disabled={pending} type="submit">
              {pending ? "Finishing..." : "Create account"}
            </button>
            <button className="ghost-button" onClick={() => setStep("otp")} type="button">
              Back
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
