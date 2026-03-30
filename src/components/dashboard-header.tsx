"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SiteLogoLink } from "@/components/site-logo-link";
import type { RoleType } from "@/lib/types";

function HeaderIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ultra-feed-icon-svg">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

type MenuTools = {
  menuOpen: boolean;
  closeMenu: () => void;
  setMenuOpen: (next: boolean | ((current: boolean) => boolean)) => void;
};

export function DashboardHeader({
  title,
  brandLabel,
  navItems,
  roles = [],
  activeRole,
  onRoleChange,
  onLogout,
  showFeedButton,
  showMessagesButton,
  headerActions,
  onMenuOpenChange,
}: {
  title: string;
  brandLabel: string;
  navItems: Array<{ href: string; label: string }>;
  roles?: readonly RoleType[];
  activeRole?: RoleType | null;
  onRoleChange?: (role: RoleType) => void;
  onLogout: () => Promise<void> | void;
  showFeedButton: boolean;
  showMessagesButton: boolean;
  headerActions?: React.ReactNode | ((tools: MenuTools) => React.ReactNode);
  onMenuOpenChange?: (open: boolean) => void;
}) {
  const [menuOpen, setMenuOpenState] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  function setMenuOpen(next: boolean | ((current: boolean) => boolean)) {
    setMenuOpenState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      onMenuOpenChange?.(resolved);
      return resolved;
    });
  }

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
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

  const tools: MenuTools = {
    menuOpen,
    closeMenu: () => setMenuOpen(false),
    setMenuOpen,
  };
  const resolvedHeaderActions =
    typeof headerActions === "function" ? headerActions(tools) : headerActions;

  return (
    <header className="ultra-feed-header app-shell-top-header">
      <SiteLogoLink brandLabel={brandLabel} pageLabel={title} />

      <div className="ultra-feed-header-actions" ref={menuRef}>
        {resolvedHeaderActions}

        {showFeedButton ? (
          <Link
            aria-label="Feed"
            className="ultra-feed-icon-button ultra-feed-header-action-button"
            href="/"
          >
            <HeaderIcon path="M4.5 3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-9.2a1 1 0 1 0-2 0V19H5V5h8.7a1 1 0 1 0 0-2H4.5zm14.8.2a1 1 0 0 0-1.4 0l-6.7 6.7a1 1 0 0 0-.27.51l-.6 2.4a1 1 0 0 0 1.22 1.22l2.4-.6a1 1 0 0 0 .5-.27l6.7-6.7a1 1 0 0 0 0-1.4l-1.1-1.1z" />
            <span className="ultra-feed-action-label">Feed</span>
          </Link>
        ) : null}

        {showMessagesButton ? (
          <Link
            aria-label="Messages"
            className="ultra-feed-icon-button ultra-feed-header-action-button"
            href="/messages"
          >
            <HeaderIcon path="M4 4a2 2 0 0 0-2 2v15.5a.5.5 0 0 0 .82.39L7.67 18H20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4zm1 4h14a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2zm0 4h10a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2z" />
            <span className="ultra-feed-action-label">Messages</span>
          </Link>
        ) : null}

        <button
          aria-label="Open menu"
          className="ultra-feed-icon-button"
          onClick={() => setMenuOpen((current) => !current)}
          type="button"
        >
          <HeaderIcon path="M4 6a1 1 0 1 1 0-2h16a1 1 0 1 1 0 2H4zm0 7a1 1 0 1 1 0-2h16a1 1 0 1 1 0 2H4zm0 7a1 1 0 1 1 0-2h16a1 1 0 1 1 0 2H4z" />
        </button>

        <div className={`ultra-feed-corner-menu ${menuOpen ? "is-open" : ""}`}>
          <div className="ultra-feed-corner-menu-section">
            <span className="ultra-feed-menu-title">Navigation</span>
            <nav>
              {navItems.map((item) => (
                <Link href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {roles.length && onRoleChange ? (
            <div className="ultra-feed-corner-menu-section">
              <span className="ultra-feed-menu-title">Active role</span>
              <div className="ultra-feed-chip-row">
                {roles.map((role) => (
                  <button
                    className={`ultra-feed-chip-button ${activeRole === role ? "is-active" : ""}`}
                    key={role}
                    onClick={() => {
                      onRoleChange(role);
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
              void Promise.resolve(onLogout()).finally(() => setMenuOpen(false));
            }}
            type="button"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
