"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  completeSignup as apiCompleteSignup,
  getDashboard,
  logout as apiLogout,
  requestOtp as apiRequestOtp,
  type StoredSession,
  verifyOtp as apiVerifyOtp
} from "@/lib/api";
import type { AccountDashboardResponse, AuthSessionResponse, RoleType } from "@/lib/types";
import { uniqueId } from "@/lib/utils";

const STORAGE_KEY = "turm.session";
const ROLE_KEY = "turm.active-role";
const DEVICE_COOKIE_NAME =
  process.env.NEXT_PUBLIC_DEVICE_COOKIE_NAME ?? "turm_device";

function writeDeviceCookie(deviceId: string | null) {
  if (typeof document === "undefined") {
    return;
  }
  if (!deviceId) {
    document.cookie = `${DEVICE_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  document.cookie = `${DEVICE_COOKIE_NAME}=${deviceId}; Path=/; Max-Age=${
    60 * 60 * 24 * 365
  }; SameSite=Lax`;
}

function readDeviceCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${DEVICE_COOKIE_NAME}=`;
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix));
  if (!match) {
    return null;
  }
  return match.slice(prefix.length) || null;
}

interface AuthContextValue {
  session: StoredSession | null;
  dashboard: AccountDashboardResponse | null;
  activeRole: RoleType | null;
  loading: boolean;
  authOpen: boolean;
  lastOtpHint: string | null;
  setAuthOpen: (open: boolean) => void;
  setActiveRole: (role: RoleType) => void;
  refreshDashboard: () => Promise<void>;
  requestOtp: (phoneNumber: string) => Promise<void>;
  verifyOtp: (input: {
    phoneNumber: string;
    otp: string;
  }) => Promise<{
    onboardingRequired: boolean;
    onboardingToken?: string | null;
    isNewUser: boolean;
  }>;
  completeSignup: (input: {
    onboardingToken: string;
    fullName: string;
    email?: string;
    defaultRole?: RoleType;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [dashboard, setDashboard] = useState<AccountDashboardResponse | null>(null);
  const [activeRole, setActiveRoleState] = useState<RoleType | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [lastOtpHint, setLastOtpHint] = useState<string | null>(null);
  const [guestDeviceId] = useState<string>(uniqueId("device"));

  const refreshDashboard = useCallback(async () => {
    const currentSession = readStoredSession();
    const deviceId = currentSession?.deviceId ?? readDeviceCookie();
    if (!deviceId) {
      setSession(null);
      setDashboard(null);
      setActiveRoleState(null);
      return;
    }

    const nextSession: StoredSession = currentSession ?? { deviceId, user: null };
    const nextDashboard = await getDashboard(nextSession);
    setSession({
      ...nextSession,
      user: nextDashboard.user
    });
    setDashboard(nextDashboard);

    const storedRole =
      typeof window !== "undefined" ? window.localStorage.getItem(ROLE_KEY) : null;
    const resolvedRole = (storedRole as RoleType | null) ?? nextDashboard.user.default_role;
    setActiveRoleState(
      nextDashboard.roles.includes(resolvedRole) ? resolvedRole : nextDashboard.user.default_role
    );
  }, []);

  const commitAuthSession = useCallback(
    async (auth: AuthSessionResponse, deviceId: string) => {
      if (!auth.user || !auth.session_expires_at) {
        throw new Error("Authentication session is incomplete.");
      }
      const nextSession: StoredSession = {
        deviceId,
        user: auth.user,
        sessionExpiresAt: auth.session_expires_at
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      }
      writeDeviceCookie(deviceId);
      setLastOtpHint(auth.dev_otp ?? null);
      setAuthOpen(false);
      await refreshDashboard();
    },
    [refreshDashboard]
  );

  useEffect(() => {
    const storedSession = readStoredSession();
    const deviceId = storedSession?.deviceId ?? readDeviceCookie();
    if (!deviceId) {
      setLoading(false);
      return;
    }

    const bootstrapSession: StoredSession = storedSession ?? { deviceId, user: null };

    getDashboard(bootstrapSession)
      .then((nextDashboard) => {
        const nextSession: StoredSession = {
          ...bootstrapSession,
          user: nextDashboard.user
        };
        setSession(nextSession);
        setDashboard(nextDashboard);
        writeDeviceCookie(deviceId);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
        const storedRole = window.localStorage.getItem(ROLE_KEY) as RoleType | null;
        const resolvedRole =
          storedRole && nextDashboard.roles.includes(storedRole)
            ? storedRole
            : nextDashboard.user.default_role;
        setActiveRoleState(resolvedRole);
      })
      .catch(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(ROLE_KEY);
        writeDeviceCookie(null);
        setSession(null);
        setDashboard(null);
        setActiveRoleState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const setActiveRole = useCallback((role: RoleType) => {
    setActiveRoleState(role);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ROLE_KEY, role);
    }
  }, []);

  const requestOtp = useCallback(
    async (phoneNumber: string) => {
      const response = await apiRequestOtp(phoneNumber, session?.deviceId ?? guestDeviceId);
      setLastOtpHint(response.dev_otp ?? null);
    },
    [guestDeviceId, session]
  );

  const verifyOtp = useCallback(
    async (input: {
      phoneNumber: string;
      otp: string;
    }) => {
      const deviceId = session?.deviceId ?? guestDeviceId;
      const auth = await apiVerifyOtp({
        phoneNumber: input.phoneNumber,
        otp: input.otp,
        deviceId
      });
      if (auth.onboarding_required) {
        writeDeviceCookie(deviceId);
        setLastOtpHint(auth.dev_otp ?? null);
        return {
          onboardingRequired: true,
          onboardingToken: auth.onboarding_token ?? null,
          isNewUser: auth.is_new_user
        };
      }
      await commitAuthSession(auth, deviceId);
      return {
        onboardingRequired: false,
        onboardingToken: null,
        isNewUser: auth.is_new_user
      };
    },
    [commitAuthSession, guestDeviceId, session]
  );

  const completeSignup = useCallback(
    async (input: {
      onboardingToken: string;
      fullName: string;
      email?: string;
      defaultRole?: RoleType;
    }) => {
      const deviceId = session?.deviceId ?? guestDeviceId;
      const auth = await apiCompleteSignup({
        onboardingToken: input.onboardingToken,
        deviceId,
        fullName: input.fullName,
        email: input.email,
        defaultRole: input.defaultRole
      });
      await commitAuthSession(auth, deviceId);
    },
    [commitAuthSession, guestDeviceId, session]
  );

  const logout = useCallback(async () => {
    const currentSession = readStoredSession();
    if (currentSession) {
      try {
        await apiLogout(currentSession);
      } catch {
        // Keep logout resilient in local dev.
      }
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(ROLE_KEY);
    }
    writeDeviceCookie(null);
    setSession(null);
    setDashboard(null);
    setActiveRoleState(null);
    setAuthOpen(false);
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      dashboard,
      activeRole,
      loading,
      authOpen,
      lastOtpHint,
      setAuthOpen,
      setActiveRole,
      refreshDashboard,
      requestOtp,
      verifyOtp,
      completeSignup,
      logout
    }),
    [
      activeRole,
      authOpen,
      dashboard,
      lastOtpHint,
      loading,
      logout,
      refreshDashboard,
      requestOtp,
      session,
      setActiveRole,
      verifyOtp,
      completeSignup
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
