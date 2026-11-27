// Thin app-specific wrappers over Kashi components/tokens only
// (brief §4.1). No hardcoded colors, font sizes or spacing here.
import type { ReactNode } from "react";

/** Page header: title top-right, optional primary action at the inline-start end. */
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        marginBlockEnd: 32,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{title}</h1>
      {action}
    </div>
  );
}

/** Page container with the brief's spacing (max width ~1100, padding ≥24). */
export function Page({ children }: { children: ReactNode }) {
  return <div style={{ padding: 24, maxWidth: 1100, marginInline: "auto" }}>{children}</div>;
}

/** One short sentence + one button (brief §4.4 empty-state rule). */
export function EmptyHint({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start", paddingBlock: 8 }}>
      <p style={{ margin: 0, color: "var(--k-color-fg-muted, #5b6676)" }}>{message}</p>
      {action}
    </div>
  );
}
