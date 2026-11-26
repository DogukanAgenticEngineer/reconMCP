# Reconcile MCP behavioral UX specification

## 1. Target behavior

A user with two or more datasets should be able to upload supported files, verify detected columns, choose matching keys and comparable fields, run a reconciliation, and inspect source-backed differences before taking action.

Optimize for correct interpretation and appropriate follow-up, not time-on-site or number of clicks.

## 2. COM-B diagnosis

- Capability: users may not know which exports to use, which fields can be compared, or what a mismatch means. Provide neutral examples, plain-language labels, mapping suggestions and row-level evidence.
- Opportunity: data may be spread across files, databases and APIs. Reduce setup friction with clear source selection, file preview and multi-source support; do not require migration to a new system.
- Motivation: users need confidence that a flagged difference is real and worth investigating. Show transparent calculations, source references and clear status labels; never use alarmist claims.

These are design hypotheses to validate with users across different data contexts, not established facts about every customer.

## 3. Journey and choice architecture

1. Upload sources: accepted file types and size limits are visible before selection. Use generic source labels and avoid implying that a file has been semantically identified before inspection.
2. Inspect: show reading state, detected columns and row count. On errors, preserve user context and state a recovery action.
3. Map: preselect obvious common headers only as editable suggestions. Keep mapping visible and explain why a field is needed. Do not silently map ambiguous fields.
4. Compare: enable the primary action only when minimum inputs and mappings are valid. Explain the disabled state through the visible workflow.
5. Review: provide a clear hierarchy for comparison, differences and summary. Keep exact row values inspectable and export available.
6. Follow up: future domain-specific findings should show calculation, units, source rows, period, confidence and a reversible disposition such as confirm, investigate or not relevant.

## 4. Motion system

- Entry: subtle 8–10px/200–480ms reveal for source cards and mapping section.
- Hover/focus: 1–2px lift and clear border/focus treatment; no movement that changes layout.
- File read: spinning glyph only while the real inspect request is pending.
- Workflow progress: step completion updates from actual app state, never from a timer.
- Compare: indeterminate pulse while the request is active. Do not display invented percentages.
- Results: short opacity reveal; no distracting number-counting or celebratory confetti.
- Dialog: fade + small scale/translate; preserve keyboard focus and close behavior.
- Reduced motion: transitions and animations collapse to near-zero duration.

Motion should remain short, calm and interruptible. It must not delay user actions.

## 5. Visual system

- Neutral surfaces dominate and preserve the Reconcile MCP identity.
- Use semantic status colors paired with labels; never use color alone.
- Use tabular numerals, consistent spacing, responsive tables and visible keyboard focus.
- Keep light/dark palettes independently readable.

## 6. Ethical constraints

No fake urgency, fabricated savings, false scarcity, deceptive defaults, hidden consent or obstructed cancellation. Do not label a variance fraud, theft or definite loss without validated evidence. Keep users in control of file selection and mapping. Collect no extra behavioral or financial data solely for engagement optimization.

## 7. Measurement plan

Instrument only after an explicit privacy review and with minimum necessary, preferably aggregate events:
- upload_started / upload_succeeded / upload_failed
- mapping_reviewed / mapping_changed
- comparison_started / comparison_succeeded / comparison_failed
- difference_opened / report_exported

Primary usability outcomes:
- proportion of eligible sessions reaching a successful comparison
- time from first upload to first interpretable result (median and p90)
- mapping correction rate and error/retry rate
- proportion of users correctly interpreting a seeded mismatch in moderated tests

Guardrails:
- false interpretation rate in usability tests
- accidental file/source swaps
- keyboard and screen-reader task completion
- reduced-motion behavior
- abandonment caused by unclear privacy or error messaging

Run moderated usability sessions first; then a randomized A/B test only if there is enough traffic and a clear, pre-registered hypothesis. Do not optimize solely for click-through or completion if interpretation accuracy worsens.

## 8. Implementation boundary

The interface currently wraps the generic CSV/XLSX reconciliation endpoint. The new journey, motion and source guidance do not add domain-specific validation or industry-specific calculations. Do not market such checks as live until their domain logic and evidence output exist.
