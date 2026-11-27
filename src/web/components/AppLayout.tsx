// App layout (brief §5.1 navigation): right-side sidebar on desktop
// (mirrored F-pattern), mobile bottom bar with four items + central «+»,
// the rest under «بیشتر». Only implemented modules are listed.
import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import {
  BottomSheet,
  Button,
  SideNav,
  type SideNavItem,
} from "@kashi-ui/react";
import { signOut } from "../lib/auth-client";

type NavEntry = { label: string; to: string };

// Only implemented modules are listed (brief §5.1).
const NAV: NavEntry[] = [
  { label: "خانه", to: "/dashboard" },
  { label: "تراکنش‌ها", to: "/transactions" },
  { label: "حساب‌ها", to: "/accounts" },
  { label: "بودجه‌ها", to: "/budgets" },
  { label: "بدهی و طلب", to: "/debts" },
  { label: "طرف‌حساب‌ها", to: "/people" },
  { label: "گزارش‌ها", to: "/reports" },
  { label: "تنظیمات", to: "/settings" },
];

const MORE: NavEntry[] = [];

function navItems(entries: NavEntry[], current: string): SideNavItem[] {
  return entries.map((e) => ({
    label: e.label,
    href: e.to,
    current: current.startsWith(e.to),
  }));
}

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Desktop: sidebar on the inline-start (right in RTL) */}
      <aside
        className="app-sidebar"
        style={{
          position: "fixed",
            insetInlineStart: 0,
          top: 0,
          bottom: 0,
          width: 240,
          padding: 16,
          borderInlineEnd: "1px solid var(--k-color-border, #e2e6ec)",
          background: "var(--k-color-surface, #fff)",
        }}
      >
        <SideNav
          aria-label="ناوبری اصلی"
          header={
            <div style={{ fontWeight: 700, padding: "8px 12px 16px" }}>دخل‌وخرج</div>
          }
          sections={[
            { items: navItems(NAV, location.pathname) },
            ...(MORE.length > 0 ? [{ items: navItems(MORE, location.pathname) }] : []),
          ]}
          footer={
            <Button
              variant="tertiary"
              size="sm"
              block
              onClick={async () => {
                await signOut();
                navigate("/login", { replace: true });
              }}
            >
              خروج
            </Button>
          }
        />
      </aside>

      {/* Content offset by the sidebar width on desktop */}
      <main className="app-main" style={{ minHeight: "100vh", paddingBlockEnd: 88 }}>
        {children}
      </main>

      {/* Mobile bottom bar */}
      <nav
        className="app-bottombar"
        aria-label="ناوبری موبایل"
        style={{
          position: "fixed",
          insetInline: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "8px 12px calc(8px + env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--k-color-border, #e2e6ec)",
          background: "var(--k-color-surface, #fff)",
        }}
      >
        {NAV.slice(0, 2).map((e) => (
          <NavLink key={e.to} to={e.to} style={{ fontSize: 14, textDecoration: "none" }}>
            {e.label}
          </NavLink>
        ))}
        <NavLink
          to="/transactions/new"
          aria-label="ثبت تراکنش جدید"
          style={{
            display: "grid",
            placeItems: "center",
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "var(--k-color-primary, #0f766e)",
            color: "#fff",
            fontSize: 28,
            textDecoration: "none",
            transform: "translateY(-12px)",
          }}
        >
          +
        </NavLink>
        
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          style={{ fontSize: 14, background: "none", border: "none", cursor: "pointer" }}
        >
          بیشتر
        </button>
      </nav>

      <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="بیشتر">
        <div style={{ display: "grid", gap: 8, paddingBlockEnd: 16 }}>
          {[...NAV, ...MORE].map((e) => (
            <Button
              key={e.to}
              variant="tertiary"
              block
              onClick={() => {
                setMoreOpen(false);
                navigate(e.to);
              }}
            >
              {e.label}
            </Button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
