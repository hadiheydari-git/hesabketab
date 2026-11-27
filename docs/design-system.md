# Design system

Status: Stage 0 — rules are fixed now; the concrete token table lands at Stage 1 when Kashi is installed and its real token names are read from the installed package (docs: kashi.sepantapouya.com).

## Kashi only

- Packages: `@kashi-ui/react`, `@kashi-ui/css` (imported once at the app entry), `@kashi-ui/persian` (Jalali conversion/formatting, Persian digits, money in words, Iranian holidays), `@kashi-ui/icons`, `@kashi-ui/bank-logos`, `@kashi-ui/tailwind` (layout utilities only).
- Prefer Kashi components for everything: buttons, inputs, selects, Jalali DatePicker/Calendar, PriceInput (amount in words), CardNumberInput (bank logo), IbanInput, dialogs, tabs, badges, progress, toasts, tables.
- Do not add a second date or icon library. Charts: Kashi chart components if they cover the need, otherwise Recharts configured for RTL (time flows right-to-left, oldest on the right, value axis on the right).
- App-specific components live in `src/web/components/ui` as thin wrappers that use Kashi tokens only. No hardcoded colors, font sizes or spacing values. If Kashi lacks a component, build it from tokens and document it here.
- Default theme light; dark theme from Kashi tokens, switchable in settings.
- Font: self-hosted Vazirmatn (Inter as Latin fallback). No external CDNs or font services at runtime.

## Semantic tokens (mapped to Kashi tokens at Stage 1)

| Token | Use |
| --- | --- |
| primary — deep emerald | primary actions, active states |
| neutral — slate | text, borders |
| background — soft neutral | page background |
| surface — white | cards, sheets |
| positive green / negative red / warning amber / info blue | income / expense / budget warning / info |
| Income is positive, expense is negative; transfers and balances are neutral. Never rely on color alone: add a sign, icon or label. |

## Layout and visual rules

- 8-pixel grid; page padding ≥24 (16 mobile); ≥32 between sections; card padding 24; content max width ~1100.
- Minimal SaaS look: subtle 1px borders, small radius, no gradients, no glassmorphism, no illustrations, no heavy shadows.
- One primary button per view. Motion only for 150 ms state changes, respecting `prefers-reduced-motion`.
- WCAG AA contrast, visible focus rings, touch targets ≥44 px.
- At most five information blocks above the fold on the dashboard; progressive disclosure («جزئیات بیشتر», filter popovers, comparisons behind a toggle).
