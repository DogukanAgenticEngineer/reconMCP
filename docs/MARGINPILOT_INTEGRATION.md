# MarginPilot — Restaurant finance layer on Reconcile MCP

## Product decision

MarginPilot is a vertical workflow on top of the existing Reconcile engine, not a fork and not a second parser/matching system.

- **Reconcile core** stays industry-neutral: bounded CSV/XLSX/rows/REST/PostgreSQL loaders, normalization, deterministic key/value comparison, missing/duplicate detection, decimal arithmetic, response-size limits and MCP transport.
- **MarginPilot** supplies restaurant source roles, financial semantics, domain rules, evidence-backed findings and a focused review workflow.
- Existing Reconcile tool names and schemas remain backward-compatible. Add the restaurant tool as an additive capability.

Initial ICP: independent cafes and restaurants. Do not add hotels, salons or generic SME accounting until this workflow is validated.

## Behavioral diagnosis (COM-B)

Target behavior: when an owner receives POS, delivery-platform and bank exports, they upload them, confirm source roles/mappings, inspect evidence-backed differences and choose what to investigate.

- Capability barrier: owners may not know gross/net sales, refunds, commissions, settlement batches and bank credits need different treatment.
- Opportunity barrier: data is scattered across exports; there is little time for manual reconciliation.
- Motivation barrier: value is uncertain until a concrete discrepancy or meaningful time saving is demonstrated.

Design: guided upload, source-role confirmation, visible formulas, linked row evidence, easy correction and dismissal. No fake savings, urgency, fear-based copy or unsupported loss claims.

## MVP workflow and sources

Start with one venue and one reporting period:
1. POS sales export.
2. Delivery-platform settlement statement.
3. Bank statement.

Supplier invoices are a later opt-in feature; invoice extraction and item identity matching need separate validation.

Source-role mappings are explicit and user-confirmed. Canonical fields include sourceType, period, currency, externalRecordId, orderId, settlementId, transactionDate, grossAmount, discountAmount, refundAmount, commissionAmount, otherDeductionAmount, netAmount, direction and evidenceRefs (source label + row number). tenantId/venueId must come from authenticated application context, never uploaded rows.

Use decimal arithmetic. Never combine currencies without a sourced FX rate. Never infer tax basis from a column name. Preserve unknown columns as unmapped warnings.

## Deterministic domain rules

### 1. Platform settlement arithmetic
expectedPayout = grossSales - refunds - commissions - campaignDeductions +/- documentedAdjustments.
Compare to reported net payout with an explicit currency tolerance. If inputs are incomplete, return insufficient_evidence rather than estimating.

### 2. Bank deposit matching
Prefer exact settlement/reference IDs. Date-and-amount proximity is only candidate_match and requires human confirmation. Split/batched deposits are out of first MVP unless tested.

### 3. POS-to-platform coverage
Compare delivery-channel POS totals with platform gross sales only after channel mapping and gross/net/tax basis are confirmed. Report coverage_variance, not missing payment by default.

### 4. Supplier price movement (later)
Compare confirmed SKU/item identity, unit, quantity and tax basis across invoices. Do not treat similar free-text descriptions as identical products without confirmation.

## Finding contract

Each finding: findingId, ruleId, severity, status, amount/currency only if directly calculable, period, source labels, row evidence references, formula/inputs, tolerance, mapping version, explanation, next check and confidenceClass.

Confidence classes:
- confirmed_arithmetic
- confirmed_reference_match
- candidate_match
- coverage_variance
- insufficient_evidence

Never call a candidate or unexplained variance fraud, theft, overcharging or definite loss. Separate discrepancy amount from recoverable cash loss. Avoid double-counting overlapping settlement and bank findings in a total.

## Proposed additive MCP capability

Tool name: `analyze_restaurant_reconciliation`.

Input:
- reporting period and venue display label;
- sources with explicit roles: pos_sales, platform_statement, bank_statement;
- user-confirmed column mappings and optional order/settlement keys;
- currency and explicit tolerances.

Output:
- `schemaVersion: marginpilot.result.v1`;
- source coverage and mapping warnings;
- findings grouped by rule and confidence;
- row evidence and reproducible calculations;
- totals partitioned by currency/confidence;
- potentialCashImpact only for non-overlapping, directly supported values;
- explicit exclusions and incomplete-data warnings.

Reuse existing source loaders, decimal primitives, response-size guards and security controls. Financial rule functions must be pure and unit-tested. No parallel parser or general matching engine.

## UX states

1. Upload: explain accepted formats, period and data handling before submission.
2. Identify: suggest source roles/mappings; require confirmation when ambiguous.
3. Preview: show row counts, period coverage, currencies, unmapped columns and missing required fields.
4. Analyze: deterministic checks with formulas and row evidence.
5. Review: confirm candidate matches, mark irrelevant with a reason, or add notes. Never auto-dismiss.
6. Export: user-initiated report with a warning that it may contain sensitive financial data.

## Privacy and release blockers

Current Reconcile docs describe stateless in-memory processing and no application-level persistent storage. Do not silently change this promise.

Before multi-customer commercial use, implement and document authentication, strict tenant isolation, per-operation authorization, rate limiting/abuse protection, encryption and an explicit retention design if persistence is introduced, customer deletion/export, metadata-only audit events, and provider log/region/retention review. The current public MCP endpoint has no application-level account authentication or distributed rate limiter; do not claim it is ready for confidential production financial data until these gaps are addressed.

## Validation gates

1. Interview 5 independent cafes/restaurants; obtain consent for redacted or synthetic exports.
2. Run real-format files manually. Track parsing failures, mapping corrections, time-to-first-useful-finding and false positives.
3. Every amount must be reproducible from cited rows and a visible formula.
4. Ask operators to verify each finding and whether they would have investigated it otherwise.
5. Continue only if at least 3/5 verify a useful finding or recurring time saving. This is an early product gate, not statistical proof.
6. Test willingness to pay with a real pilot offer. €15–29/month remains a hypothesis, not validated pricing.

Primary metrics: time to first verified finding, operator-confirmed finding share, false-positive rate per rule, mapping failure rate, recurring use, paid pilot conversion and retention.

Guardrails: zero unsupported fraud/definite-loss claims; zero cross-tenant exposure; zero silent currency/tax-basis mixing; every amount has reproducible evidence; easy correction and dismissal.

## Implementation sequence

- M0: product contract (this document), no runtime behavior change.
- M1: pure financial types, settlement arithmetic, finding schema and synthetic unit tests.
- M2: additive MCP tool reusing current loaders and response limits.
- M3: guided source-role/mapping preview and evidence-first report UI.
- M4: auth, tenant isolation, rate limits, retention decision and five-customer pilot.

M1 must not alter the general Reconcile comparison behavior. Existing tests and tool contracts are regression gates.
