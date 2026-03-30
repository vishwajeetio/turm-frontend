"use client";

import { usePathname } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { useAuth } from "@/components/providers/auth-provider";

export function AppShell({
  title,
  eyebrow: _eyebrow,
  description: _description,
  actions: _actions,
  headerActions,
  showHero: _showHero = true,
  children
}: {
  title: string;
  eyebrow: string;
  description: string;
  actions?: React.ReactNode;
  headerActions?:
    | React.ReactNode
    | ((tools: {
        menuOpen: boolean;
        closeMenu: () => void;
        setMenuOpen: (next: boolean | ((current: boolean) => boolean)) => void;
      }) => React.ReactNode);
  showHero?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { activeRole, dashboard, logout, setActiveRole } = useAuth();
  const onMessagesPage = pathname === "/messages";
  const brandLabel = dashboard?.active_subscription.plan_code === "PREMIUM" ? "PRO" : "Turm";
  const hasTenantAccess =
    Boolean(dashboard?.roles.includes("TENANT")) || dashboard?.user.default_role === "TENANT";
  const hasListerAccess =
    Boolean(dashboard?.roles.includes("OWNER")) ||
    Boolean(dashboard?.roles.includes("BROKER")) ||
    dashboard?.user.default_role === "OWNER" ||
    dashboard?.user.default_role === "BROKER";
  const navItems = [
    { href: "/", label: "Feed" },
    { href: "/messages", label: "Messages" },
    { href: "/likes", label: "Likes" },
    { href: "/plan", label: "Plan" },
    ...(hasListerAccess ? [{ href: "/properties", label: "Properties" }] : []),
    ...(hasTenantAccess ? [{ href: "/profile", label: "Profile" }] : []),
    { href: "/settings", label: "Settings" }
  ];

  return (
    <div className="app-shell-modern">
      <DashboardHeader
        activeRole={activeRole}
        brandLabel={brandLabel}
        headerActions={headerActions}
        navItems={navItems}
        onLogout={logout}
        onRoleChange={setActiveRole}
        roles={dashboard?.roles ?? []}
        showFeedButton
        showMessagesButton={!onMessagesPage}
        title={title}
      />

      <main className="app-shell-main-modern">
        <section className="app-shell-page-content">{children}</section>
      </main>
    </div>
  );
}
