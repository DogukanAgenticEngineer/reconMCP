# MarginPilot UI system

## Product direction

A calm, evidence-first finance workspace for independent cafes and restaurants. It should feel like a trustworthy financial operations product, not a restaurant POS, bookkeeping replacement, or marketing landing page.

Learn interaction principles from Stripe Dashboard (financial tables and precise drill-downs), Linear (restrained chrome and compact navigation), and Vercel (consistent geometry and predictable settings). Do not copy proprietary assets or layouts pixel-for-pixel.

## Brand palette

Neutral-led 60/30/10 balance. Most of the interface remains neutral; brand green is reserved for primary actions, focus and verified states. Amber means review-needed or uncertain. Red is reserved for confirmed negative/critical states. Never use color alone to communicate status.

Light theme:
- Canvas #F5F7F4; surface #FFFFFF; soft surface #F8FAF8
- Primary text #17231E; secondary #68766F; border #E3E9E4
- Brand green #176B52; soft green #E7F3ED
- Review amber #A96713 / #FFF4DF
- Critical red #B83E3E / #FFF0EF
- Verified green #16724F / #E8F5ED

Dark theme is independently tuned, not inverted:
- Canvas #101713; surface #17211B; raised surface #202D25
- Text #EDF5EF; muted #A2B1A7; border #2B3B31
- Brand #75C7A3; amber #E9B65E; red #FF8981

Status rules: verified/match=green; candidate/needs review=amber; confirmed mismatch/critical=red; not evaluated=neutral. A plausible bank match must remain amber until a human confirms it.

## Typography

Use installed Geist Variable with Inter/system fallbacks. Page heading 38–66px; section heading 16px semibold; body 12–14px with 1.5–1.65 line-height; metadata/table labels 10–11px. Use tabular numerals for financial columns and right-align numeric values. Use monospace only for IDs/references/technical payloads when needed. Avoid decorative display fonts.

## Layout and density

- 4px spacing base; preferred steps 4, 8, 12, 16, 24, 32, 48.
- Max content width 1440px; tables can use full available width.
- 8–15px radii, low-elevation shadows, quiet 1px borders.
- Show 3–5 headline metrics only when they are real and calculated.
- Tables are the source of truth; charts summarize and never replace row-level evidence.
- Avoid decorative gauges, excessive pills, glass effects and borders around every nested element.
- Responsive: stack at tablet widths, preserve horizontal table scrolling, and keep primary action easy to reach on mobile.

## Information architecture

1. Overview: selected venue and period, source coverage, last completed analysis only if actually persisted, and one next action.
2. Sources: upload POS, platform settlement and bank exports; show format, size, row count, period and currency.
3. Mapping: explicit source roles and user-confirmed financial mappings; show unknown fields.
4. Analysis: clear progress stages; never imply a financial check ran if it did not.
5. Findings: evidence-first list with amount/currency, severity, confidence, period, affected sources and next step.
6. Finding detail: formula, source row references, inputs, tolerance and side-by-side evidence.
7. Export: user-triggered report with data-sensitivity warning.

## Behavioral design

Target behavior: upload exports, confirm ambiguous mappings, inspect an evidence-backed finding and choose the next action.

Reduce friction without hiding consequential decisions:
- Give source-specific upload guidance and accepted formats.
- Suggest mappings but require confirmation for ambiguous financial semantics.
- Preview row count, period, currency and unmapped fields before analysis.
- Explain calculations in plain language and show exact source rows.
- Allow users to confirm candidate matches, mark findings not relevant and revisit dismissed items.
- No fake urgency, fabricated savings, fear-based warnings or dark patterns.
- Empty states explain the next useful action; errors explain what failed and how to recover.

## Accessibility and trust

- Target WCAG 2.2 AA contrast for text and controls; visible keyboard focus.
- Pair status colors with labels/icons; do not rely on color alone.
- Respect reduced-motion preferences.
- Use semantic headings, labels, button names, table headers and live error announcements.
- Support keyboard operation and screen-reader descriptions for dropzones and switches.
- Never truncate a financial value without an accessible way to inspect it.
- Never label an unverified variance as fraud, theft or confirmed loss.

## Current implementation boundary

The current app is a MarginPilot-branded preview over the existing generic CSV/XLSX comparison endpoint. It does not yet run restaurant-specific settlement arithmetic, platform commission checks, bank payout matching or POS-to-platform coverage rules. The UI must not imply that those domain checks have run until the additive MarginPilot workflow is implemented and tested.

## Review checklist

- [ ] Source roles and field mappings are explicit and user-confirmed.
- [ ] All displayed amounts are sourced from real analysis output.
- [ ] Candidate and confirmed findings are visually distinct.
- [ ] Numeric columns align and remain readable at high row counts.
- [ ] Light/dark themes meet contrast requirements.
- [ ] Keyboard, focus, mobile, reduced-motion and empty/error states are tested.
- [ ] No persistence or analytics is introduced without privacy review.
