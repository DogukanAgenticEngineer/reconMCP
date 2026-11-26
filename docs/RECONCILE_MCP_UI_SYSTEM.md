# Reconcile MCP UI system

## Product identity

Reconcile MCP is an industry-neutral, privacy-conscious data reconciliation workspace and MCP server. The interface should communicate dependable comparison, explicit user control and inspectable evidence. It is not an accounting replacement or a vertical-specific dashboard.

## Design principles

- Keep the core workflow useful for datasets from many domains.
- Explain accepted formats, size limits, detected columns and row counts before comparison.
- Make source selection, field mapping and comparison settings explicit and editable.
- Keep exact values and source references inspectable; distinguish matches, mismatches, missing records, duplicates and schema differences.
- Avoid unsupported claims about savings, fraud, compliance or financial loss.
- Treat MCP as an integration surface for compatible clients, not as a replacement for the user-facing workspace.

## Information architecture

1. Sources: upload two or more supported datasets; show file format, size, row count and detected columns.
2. Mapping: select stable keys and comparable fields; show suggestions as editable choices.
3. Comparison: run deterministic reconciliation only after required inputs are valid.
4. Evidence: inspect comparison groups, differences and summary metrics; export the complete report.
5. Integration: expose the Streamable HTTP MCP endpoint and available tools with clear setup guidance.

## Visual system

- Neutral surfaces dominate; use the existing Reconcile MCP brand identity.
- Use restrained green for primary actions and verified states, amber for review-needed states, and red for confirmed mismatches or critical errors.
- Pair every color-coded state with text; never rely on color alone.
- Use tabular numerals for values, consistent spacing, low-elevation surfaces and responsive tables.
- Keep the existing light/dark themes and ensure readable contrast in both.

## Motion and feedback

- Use subtle, short entry transitions without layout shifts.
- Show file-reading feedback only while the real inspect request is pending.
- Update workflow completion from actual application state, never from timers.
- Use indeterminate feedback while comparison requests are active; do not invent percentages.
- Keep result and dialog transitions restrained and interruptible.
- Respect `prefers-reduced-motion` and collapse nonessential motion.

## Accessibility and trust

- Target WCAG 2.2 AA contrast for text and controls; retain visible keyboard focus.
- Use semantic headings, labels, button names, table headers and live error announcements.
- Support keyboard operation and screen-reader descriptions for dropzones and switches.
- Never truncate a value without an accessible way to inspect it.
- Make errors actionable and preserve user context where possible.
- Do not introduce persistence, analytics or additional data collection without privacy review.

## Current implementation boundary

The UI wraps the existing generic CSV/XLSX reconciliation endpoint. It must describe only the comparison and evidence actually returned by that endpoint. Future domain-specific workflows require separate schemas, tested rules and source-backed evidence before being represented as available product capabilities.
