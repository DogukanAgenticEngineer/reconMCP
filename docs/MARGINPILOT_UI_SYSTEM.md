# MarginPilot UI system

## Product design direction

MarginPilot is a calm, evidence-first finance workspace for independent cafes and restaurants. It should feel like a trustworthy financial operations product, not a restaurant POS, bookkeeping replacement, or marketing landing page.

Reference patterns to learn from:
- Stripe Dashboard: financial data hierarchy, precise tables, aligned amounts and drill-downs.
- Linear: restrained chrome, compact navigation, clear active states and keyboard-friendly controls.
- Vercel: consistent component geometry, quiet surfaces and predictable settings patterns.

Do not copy proprietary assets or layouts pixel-for-pixel. Reuse the underlying interaction principles.

## Brand palette

Use a neutral-led 60/30/10 balance. Most of the interface remains neutral; brand green is reserved for primary actions, focus and positive/verified states. Amber indicates review-needed or uncertain items. Red is reserved for confirmed negative/critical states. Never use color alone to communicate a state.

Light theme:
- Canvas: #F5F7F4
- Surface: #FFFFFF
- Soft surface: #F8FAF8
- Primary text: #17231E
- Secondary text: #68766F
- Border: #E3E9E4
- Brand green: #176B52
- Brand soft: #E7F3ED
- Review amber: #A96713 / #FFF4DF
- Critical red: #B83E3E / #FFF0EF
- Verified green: #16724F / #E8F5ED

Dark theme is independently tuned, not a simple inversion:
- Canvas #101713; surface #17211B; raised surface #202D25
- Text #EDF5EF; muted #A2B1A7; borders #2B3B31
- Brand #75C7A3; amber #E9B65E; red #FF8981

Status rules:
- Match / verified: green + text/icon.
- Candidate / needs review: amber + text/icon.
- Confirmed mismatch / critical: red + text/icon.
- Informational / not evaluated: neutral.
- Do not show green for a merely plausible bank match. A candidate remains amber until confirmed.

## Typography

Use the already installed Geist Variable as the primary family, with Inter and system fallbacks. Use a restrained type scale:
- Page heading: responsive 38–66px, semibold, tight line-height.
- Section heading: 16px / semibold.
- Body: 12–14px / regular, line-height 1.5–1.65.
- Metadata and table labels: 10–11px, medium/semibold.
- Financial values and table numbers: tabular numerals; right-align numeric columns.
Avoid decorative display fonts. Use a mono font only for IDs, references, code and technical payloads if/when those views are added.

## Layout and density

- 4px spacing base; preferred steps 4, 8, 12, 16, 24, 32, 48.
- Content max-width 1440px; readable data tables may use the full available width.
- 8–15px corner radii, low-elevation shadows, quiet 1px borders.
- Keep 3–5 high-value metrics above the fold only when those metrics are real and calculated.
- Tables are the source of truth; charts summarize rather than replace row-level evidence.
- Prefer one or two useful charts over decorative donut/gauge cards.
- Avoid gradients, glass effects, excessive pill badges and a border around every nested element.
- Responsive: stack columns at tablet widths; preserve table horizontal scrolling; keep primary action visible on mobile.

## Core information architecture

1. Overview: selected venue and period, source coverage, last completed analysis (only if actually persisted), and a single next action.
2. Sources: upload POS, platform settlement and bank exports; show format, size, row count, detected period and currency.
3. Mapping: explicit source roles and user-confirmed financial field mappings; show unknown fields and mapping confidence.
4. Analysis: progress and clear stages; never imply a financial check ran if it did not.
5. Findings: evidence-first list with amount/currency, severity, confidence class, period, affected sources and next step.
6. Finding detail: formula, source row references, inputs, tolerance and a side-by-side evidence table.
7. Export: user-triggered report with data sensitivity warning.

## Interaction and behavioral design

The target behavior is: upload exports, confirm ambiguous source mappings, inspect an evidence-backed finding and choose the next action.

Reduce friction without hiding consequential decisions:
- Provide source-specific upload guidance and accepted formats.
- Suggest mappings only as suggestions; require confirmation for ambiguous financial semantics.
- Preview row count, period, currency and unmapped fields before analysis.
- Explain the calculation in plain language and show the exact rows behind it.
- Allow users to confirm candidate matches, mark a finding not relevant with an optional reason, and revisit dismissed items.
- Do not use fake urgency, fabricated savings, fear-based warnings or dark patterns.
- Empty states should explain the next useful action; error states should say what failed and how to recover.

## Accessibility and trust

- Target WCAG 2.2 AA contrast for text and controls; visible keyboard focus.
- Do not rely on color alone: pair statuses with labels and icons.
- Respect reduced-motion preferences.
- Use semantic headings, labels, button names, table headers and live error announcements.
- Support keyboard operation and screen-reader descriptions for dropzones and switches.
- Use tabular numerals for comparable amounts; never truncate a financial value without an accessible way to inspect it.
- Avoid false financial precision: format compactly in summaries, retain exact values in detail/export.
- Never label an unverified variance as fraud, theft or confirmed loss.

## Current implementation boundary

The current app is a generic CSV/XLSX comparison UI rebranded as a MarginPilot preview. It still invokes the existing generic comparison endpoint. It does not yet run restaurant-specific settlement arithmetic, platform commission checks, bank payout matching or POS-to-platform coverage rules. The UI must not claim that those domain checks have run until the additive MarginPilot MCP/API workflow is implemented and tested.

## Review checklist

- [ ] Source role and field mappings are explicit and user-confirmed.
- [ ] All displayed amounts are sourced from real analysis output.
- [ ] Candidate and confirmed findings are visually distinct.
- [ ] Numeric columns align and remain readable at high row counts.
- [ ] Light and dark themes both meet contrast requirements.
- [ ] Keyboard, focus, mobile, reduced-motion and empty/error states are tested.
- [ ] No new persistence or analytics is introduced without a privacy review.
