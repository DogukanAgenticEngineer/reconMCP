# MarginPilot behavioral UX specification

## 1. Target behavior

When an independent restaurant operator has exported sales and settlement/bank files, they should upload the relevant files, verify the detected columns, run a comparison, and inspect at least one source-backed difference before deciding what to do.

The product should optimize for correct interpretation and appropriate follow-up, not time-on-site or number of clicks.

## 2. COM-B diagnosis

- Capability: operators may not know which export to use, what fields can be compared, or what a mismatch means. Provide source-specific examples, plain-language labels, mapping suggestions and row-level evidence.
- Opportunity: exports are scattered across POS, delivery platforms and bank portals. Reduce setup friction with drag/drop, file preview and multi-source support; avoid requiring a POS migration or API integration.
- Motivation: operators need confidence that a flagged amount is real and worth investigating. Show transparent calculations, source references and confidence labels; never use alarmist loss claims.

These are design hypotheses to validate with actual restaurant operators, not established facts about every customer.

## 3. Journey and choice architecture

1. Upload sources: accepted file types and size limits are visible before selection. Source A/B examples explain common restaurant exports without asserting that the uploaded file has been semantically identified.
2. Inspect: show reading state, detected columns and row count. On errors, preserve the user's context and state a recovery action.
3. Map: preselect obvious common headers only as editable suggestions. Keep the mapping visible and explain why a field is needed. Do not silently map ambiguous money fields.
4. Compare: enable the primary action only when the minimum inputs and mappings are valid. Explain disabled state through the visible workflow, not a mysterious disabled button.
5. Review: use a clear hierarchy for comparison, differences and summary. Keep exact row values inspectable and export available.
6. Follow up: future MarginPilot-specific findings should show calculation, amount/currency, source rows, period, confidence and a reversible disposition such as confirm, investigate or not relevant.

## 4. Motion system

Motion is functional feedback:
- Entry: subtle 8–10px/200–480ms reveal for source cards and mapping section.
- Hover/focus: 1–2px lift and clear border/focus treatment; no movement that changes layout.
- File read: spinning glyph only while the real inspect request is pending.
- Workflow progress: step completion updates from actual app state, never from a timer.
- Compare: indeterminate pulse while the request is active. Do not display invented percentages.
- Results: short opacity reveal; no distracting number-counting or celebratory confetti for financial discrepancies.
- Dialog: fade + small scale/translate; preserve keyboard focus and close behavior.
- Reduced motion: all transitions and animations collapse to near-zero duration.

Motion should remain short, calm and interruptible. It must not delay user actions.

## 5. Visual system

- Typeface: Geist Variable, with Inter/system fallback.
- Neutral surfaces dominate; forest green indicates primary action and verified states.
- Amber signals uncertain or review-needed states; red signals confirmed mismatch/critical states.
- Pair every color-coded state with text; never use color alone.
- Financial values use tabular numerals; exact amounts remain available in detail.
- Low-elevation surfaces, quiet borders, 8–15px radii and consistent 4px spacing scale.
- Responsive tables remain horizontally scrollable; keyboard focus is visible.
- Light/dark palettes are independently tuned.

## 6. Ethical constraints

No fake urgency, fabricated savings, false scarcity, deceptive defaults, hidden consent or obstructed cancellation. Do not call a variance fraud, theft or confirmed loss without validated evidence. Keep users in control of file selection and mapping. Collect no extra behavioral or financial data solely for engagement optimization.

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

This interface currently wraps the generic CSV/XLSX reconciliation endpoint. The new journey, motion and source guidance do not add POS-specific settlement validation, commission auditing, bank payout matching or verified profit-loss calculations. Do not market those checks as live until their domain logic and evidence output exist.
