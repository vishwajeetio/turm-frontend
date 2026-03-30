import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { AccountDashboardResponse } from "@/lib/types";

const SESSION_COOKIE_NAME =
  process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? "turm_session";
const DEVICE_COOKIE_NAME =
  process.env.NEXT_PUBLIC_DEVICE_COOKIE_NAME ?? "turm_device";
const SERVER_API_BASE =
  process.env.API_SERVER_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000/api/v1";

function normalizeNextPath(nextPath: string | null | undefined) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }
  return nextPath;
}

function loginRedirect(nextPath: string) {
  const resolvedNextPath = normalizeNextPath(nextPath);
  return `/login?next=${encodeURIComponent(resolvedNextPath)}`;
}

function isTenantDashboard(dashboard: AccountDashboardResponse) {
  return dashboard.roles.includes("TENANT") || dashboard.user.default_role === "TENANT";
}

function isListerDashboard(dashboard: AccountDashboardResponse) {
  return (
    dashboard.roles.includes("OWNER") ||
    dashboard.roles.includes("BROKER") ||
    dashboard.user.default_role === "OWNER" ||
    dashboard.user.default_role === "BROKER"
  );
}

async function fetchDashboard(cookieHeader: string, deviceId: string) {
  const response = await fetch(`${SERVER_API_BASE}/accounts/me/dashboard`, {
    method: "GET",
    headers: {
      Cookie: cookieHeader,
      "X-Device-Id": deviceId,
      "X-Client-Platform": "web-server",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AccountDashboardResponse;
}

export async function getOptionalDashboardAuth(): Promise<AccountDashboardResponse | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const deviceCookie = cookieStore.get(DEVICE_COOKIE_NAME);
  if (!sessionCookie?.value || !deviceCookie?.value) {
    return null;
  }

  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  return fetchDashboard(cookieHeader, deviceCookie.value);
}

export async function requireDashboardAuth(nextPath = "/"): Promise<AccountDashboardResponse> {
  const dashboard = await getOptionalDashboardAuth();
  if (!dashboard) {
    redirect(loginRedirect(nextPath));
  }
  return dashboard;
}

export async function requireTenantDashboardAuth(nextPath = "/profile") {
  const dashboard = await requireDashboardAuth(nextPath);
  if (!isTenantDashboard(dashboard)) {
    redirect("/");
  }
  return dashboard;
}

export async function requireListerDashboardAuth(nextPath = "/properties") {
  const dashboard = await requireDashboardAuth(nextPath);
  if (!isListerDashboard(dashboard)) {
    redirect("/");
  }
  return dashboard;
}

export async function redirectAuthenticatedToDashboard(nextPath = "/") {
  const dashboard = await getOptionalDashboardAuth();
  if (!dashboard) {
    return;
  }
  redirect(normalizeNextPath(nextPath));
}
