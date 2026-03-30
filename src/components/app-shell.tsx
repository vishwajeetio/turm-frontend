"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";

function ShellIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ultra-feed-icon-svg">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

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
        setMenuOpen: (next: boolean) => void;
      }) => React.ReactNode);
  showHero?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { activeRole, dashboard, logout, setActiveRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
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
  const resolvedHeaderActions =
    typeof headerActions === "function"
      ? headerActions({
          menuOpen,
          closeMenu: () => setMenuOpen(false),
          setMenuOpen: (next) => setMenuOpen(next)
        })
      : headerActions;

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  return (
    <div className="app-shell-modern">
      <header className="ultra-feed-header app-shell-top-header">
        <div className="ultra-feed-header-left">
          <span className="ultra-feed-brand-mark">T</span>
          <div>
            <strong>{brandLabel}</strong>
            <span>{title}</span>
          </div>
        </div>

        <div className="ultra-feed-header-actions" ref={menuRef}>
          {resolvedHeaderActions ?? (
            <>
              {onMessagesPage ? (
                <Link
                  aria-label="Feed"
                  className="ultra-feed-icon-button ultra-feed-header-action-button"
                  href="/"
                >
                  <ShellIcon path="M4.5 3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-9.2a1 1 0 1 0-2 0V19H5V5h8.7a1 1 0 1 0 0-2H4.5zm14.8.2a1 1 0 0 0-1.4 0l-6.7 6.7a1 1 0 0 0-.27.51l-.6 2.4a1 1 0 0 0 1.22 1.22l2.4-.6a1 1 0 0 0 .5-.27l6.7-6.7a1 1 0 0 0 0-1.4l-1.1-1.1z" />
                  <span className="ultra-feed-action-label">Feed</span>
                </Link>
              ) : (
                <Link
                  aria-label="Feed"
                  className="ultra-feed-icon-button ultra-feed-header-action-button"
                  href="/"
                >
                  <ShellIcon path="M4.5 3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-9.2a1 1 0 1 0-2 0V19H5V5h8.7a1 1 0 1 0 0-2H4.5zm14.8.2a1 1 0 0 0-1.4 0l-6.7 6.7a1 1 0 0 0-.27.51l-.6 2.4a1 1 0 0 0 1.22 1.22l2.4-.6a1 1 0 0 0 .5-.27l6.7-6.7a1 1 0 0 0 0-1.4l-1.1-1.1z" />
                  <span className="ultra-feed-action-label">Feed</span>
                </Link>
              )}

              {!onMessagesPage ? (
                <Link
                  aria-label="Messages"
                  className="ultra-feed-icon-button ultra-feed-header-action-button"
                  href="/messages"
                >
                  <ShellIcon path="M4 4a2 2 0 0 0-2 2v15.5a.5.5 0 0 0 .82.39L7.67 18H20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4zm1 4h14a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2zm0 4h10a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2z" />
                  <span className="ultra-feed-action-label">Messages</span>
                </Link>
              ) : null}
            </>
          )}
          <button
            aria-label="Open menu"
            className="ultra-feed-icon-button"
            onClick={() => setMenuOpen((current) => !current)}
            type="button"
          >
            <ShellIcon path="M4 6a1 1 0 1 1 0-2h16a1 1 0 1 1 0 2H4zm0 7a1 1 0 1 1 0-2h16a1 1 0 1 1 0 2H4zm0 7a1 1 0 1 1 0-2h16a1 1 0 1 1 0 2H4z" />
          </button>

          <div className={`ultra-feed-corner-menu ${menuOpen ? "is-open" : ""}`}>
            <div className="ultra-feed-corner-menu-section">
              <span className="ultra-feed-menu-title">Navigation</span>
              <nav>
                {navItems.map((item) => (
                  <Link
                    href={item.href}
                    key={item.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            {dashboard?.roles?.length ? (
              <div className="ultra-feed-corner-menu-section">
                <span className="ultra-feed-menu-title">Active role</span>
                <div className="ultra-feed-chip-row">
                  {dashboard.roles.map((role) => (
                    <button
                      className={`ultra-feed-chip-button ${activeRole === role ? "is-active" : ""}`}
                      key={role}
                      onClick={() => {
                        setActiveRole(role);
                        setMenuOpen(false);
                      }}
                      type="button"
                    >
                      {role.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              className="ultra-feed-menu-utility"
              onClick={() => {
                void logout();
                setMenuOpen(false);
              }}
              type="button"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="app-shell-main-modern">
        <section className="app-shell-page-content">{children}</section>
      </main>
    </div>
  );
}
