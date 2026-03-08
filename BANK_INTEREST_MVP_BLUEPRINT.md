# Bank Interest Calculation SaaS – MVP Blueprint (12 Weeks)

## Where to start

- Main repository overview: [README.md](README.md)
- Domain/platform implementation details: [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
- Domain security, tenant controls, and rollback: [SECURITY_DOMAINS.md](SECURITY_DOMAINS.md)
- Calculator UAT/checker invariants: [Calculator Invariants (UAT/Checker Reference)](#10-calculator-invariants-uatchecker-reference)

## 1) Non-Impact Guardrails (Must-Haves)

To ensure existing eMobility portal functionality is not impacted, all work is additive and isolated:

1. **Domain isolation only**
   - Add new screens under existing `fintech` domain (do not change existing `emobility` view mappings).
   - No changes to existing eMobility data paths or UI routes.

2. **Feature flags**
   - Add `ENABLE_BANKING_INTEREST_MVP` flag (default `false`) and gate all new screens/API calls.
   - New menu items appear only when flag is enabled and user has fintech access.

3. **Separate data namespace**
   - Use dedicated Firebase paths/API tables prefixed by `banking/` (or separate DB schema).
   - Never reuse existing eMobility entities (`services`, `pricingRules`, etc.) for banking data.

4. **Backward compatibility contract**
   - No modifications to existing `View` behavior used by eMobility screens.
   - New views only; no renames/removals of existing routes or sidebar labels.

5. **Release strategy**
   - Dev → UAT → pilot tenant only.
   - Toggle-based rollback in under 5 minutes by disabling the feature flag.

---

## 2) MVP Scope (What this release includes)

### In scope (MVP)
- Deposit-style interest products (Savings and Term Deposit).
- Effective-dated tiered rates.
- Day-count conventions (`ACT/365F`, `ACT/360`, `30E/360`).
- Accrual and payout frequency rules.
- Maker-checker publish workflow.
- Deterministic calculation API with explainable breakdown.
- Tenant isolation and audit trail.

### Out of scope (Phase 2+)
- Loan amortization engines.
- Complex floating benchmark curves (e.g., SONIA/EURIBOR feeds).
- IFRS EIR accounting engine.
- Multi-ledger posting orchestration.

---

## 3) Data Entities (MVP)

All entities include: `id`, `tenantId`, `status`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `version`.

### 3.1 InterestProduct
Defines the product configuration.

- `productCode` (unique per tenant)
- `name`
- `productType` (`SAVINGS` | `TERM_DEPOSIT`)
- `currency`
- `dayCountConvention`
- `accrualFrequency` (`DAILY` | `MONTHLY`)
- `payoutFrequency` (`MONTHLY` | `QUARTERLY` | `AT_MATURITY`)
- `compounding` (`NONE` | `DAILY` | `MONTHLY`)
- `roundingScale` (e.g., 2, 6)
- `roundingMode` (`HALF_UP`, etc.)
- `minimumBalance` (optional)
- `allowNegativeRates` (bool)

### 3.2 RateBook
Logical container for rates by product and period.

- `rateBookCode`
- `productId`
- `effectiveFrom`
- `effectiveTo` (nullable)
- `approvalState` (`DRAFT` | `PENDING_APPROVAL` | `APPROVED` | `REJECTED`)
- `approvedBy`, `approvedAt`

### 3.3 RateTier
Tiered rates for balance bands.

- `rateBookId`
- `tierFromAmount`
- `tierToAmount` (nullable means infinity)
- `annualRatePercent`
- `isPromotional` (bool)
- `promoFrom`, `promoTo` (optional)

### 3.4 CustomerSegment (Reference)

- `segmentCode`
- `segmentName`
- `eligibilityRules` (MVP: static tags only)

### 3.5 AccountRateAssignment
Assigns product and optional segment/rate override.

- `accountId` (external reference)
- `customerId` (external reference)
- `productId`
- `segmentCode` (optional)
- `rateBookId` (optional explicit lock)
- `startDate`, `endDate`

### 3.6 BalanceSnapshot (Input)
Daily closing balances used for accrual.

- `accountId`
- `asOfDate`
- `closingBalance`
- `currency`
- `sourceSystem`

### 3.7 InterestAccrual (Output)

- `accountId`
- `asOfDate`
- `principalForDay`
- `appliedRate`
- `dayFraction`
- `accruedAmount`
- `rateBookVersion`
- `calculationTraceId`

### 3.8 InterestPayout (Output)

- `accountId`
- `periodStart`, `periodEnd`
- `grossInterest`
- `taxAmount`
- `netInterest`
- `payoutDate`
- `status`

### 3.9 CalculationTrace
Explainability + audit artifact.

- `traceId`
- `inputHash`
- `steps[]` (selected tier, day count, formula, rounding)
- `resultHash`

### 3.10 ApprovalAction (Audit Extension)

- `entityType`
- `entityId`
- `action` (`SUBMIT`, `APPROVE`, `REJECT`, `PUBLISH`, `ROLLBACK`)
- `comment`

---

## 4) API Endpoints (MVP)

Base: `/api/v1/banking-interest`

Auth: JWT + tenant claim. Every request enforces `tenantId` server-side.

### Product and reference management
- `POST /products`
- `GET /products`
- `GET /products/{productId}`
- `PATCH /products/{productId}`
- `POST /segments`
- `GET /segments`

### Rate book lifecycle
- `POST /rate-books`
- `GET /rate-books?productId=&state=&effectiveDate=`
- `GET /rate-books/{rateBookId}`
- `PATCH /rate-books/{rateBookId}`
- `POST /rate-books/{rateBookId}/tiers`
- `PUT /rate-books/{rateBookId}/tiers/{tierId}`
- `DELETE /rate-books/{rateBookId}/tiers/{tierId}`
- `POST /rate-books/{rateBookId}/submit`
- `POST /rate-books/{rateBookId}/approve`
- `POST /rate-books/{rateBookId}/reject`
- `POST /rate-books/{rateBookId}/publish`

### Account assignment
- `POST /assignments`
- `GET /assignments?accountId=&productId=`
- `PATCH /assignments/{assignmentId}`

### Calculation and reconciliation
- `POST /calculate/preview`
  - Input: account, principal/balance snapshots, date range, product/rate optional overrides
  - Output: accrual schedule + trace
- `POST /calculate/batch`
  - Async job for many accounts
- `GET /jobs/{jobId}`
- `GET /accruals?accountId=&from=&to=`
- `GET /payouts?accountId=&from=&to=`
- `POST /reconcile`
  - Compare expected accruals vs posted ledger/payout data

### Audit and export
- `GET /audit?entityType=&entityId=&from=&to=`
- `GET /exports/accruals.csv?from=&to=&productId=`

---

## 5) Exact Screens to Add in This Portal

Add these as **new views** under fintech domain only.

1. **Interest Products Manager** (`interestProducts`)
   - CRUD product definitions and conventions.
   - Validation for day count, frequency, compounding, rounding.

2. **Rate Book Manager** (`interestRateBooks`)
   - Create effective-dated rate books.
   - Add/edit tier rows and promo windows.
   - Overlap validation (no conflicting approved windows).

3. **Rate Approval Workbench** (`interestApprovals`)
   - Maker/checker queue.
   - Submit/approve/reject with mandatory comment.
   - Publish and rollback actions.

4. **Account Assignment Manager** (`interestAssignments`)
   - Map accounts/customers to products and segments.
   - Optional account-level override binding to specific rate book version.

5. **Interest Calculator (Banking)** (`interestCalculator`)
   - Manual scenario simulation.
   - Input principal or balance snapshots + date range.
   - Show breakdown: tier chosen, day fraction, daily accrual, total payout.

6. **Accrual & Payout Results** (`interestResults`)
   - Query accruals/payouts by date/account/product.
   - CSV export and trace drill-down.

7. **Reconciliation Dashboard** (`interestReconciliation`)
   - Variance summary by tenant/product/date.
   - Exception list for failed or mismatched calculations.

8. **Interest Audit Trail** (`interestAudit`)
   - Entity timeline (product/rate/approval/calculation job actions).
   - Tenant-safe filtering + export.

---

## 6) Suggested Firebase/Storage Paths (if keeping current stack)

- `banking/products/{id}`
- `banking/rateBooks/{id}`
- `banking/rateTiers/{id}` or nested under rateBook
- `banking/segments/{id}`
- `banking/assignments/{id}`
- `banking/balanceSnapshots/{id}`
- `banking/accruals/{id}`
- `banking/payouts/{id}`
- `banking/calcTraces/{id}`
- `banking/jobs/{id}`
- `banking/audit/{id}`

All records must include `tenantId`; security rules must enforce tenant match on read/write.

---

## 7) 12-Week Delivery Plan

### Weeks 1–2: Foundations
- Finalize requirements, product formulas, precision and rounding policy.
- Define API contracts and data model.
- Add feature flag and fintech-only menu placeholders.
- Build tenant-safe backend scaffolding and auth middleware.

### Weeks 3–4: Product + Rate Setup
- Build Interest Products Manager + Rate Book Manager.
- Implement tier validations and effective-date overlap checks.
- Add draft persistence and basic audit logging.

### Weeks 5–6: Approval Workflow
- Build Rate Approval Workbench.
- Implement maker-checker transitions and publish/rollback.
- Add immutable approval audit events.

### Weeks 7–8: Calculation Engine
- Build preview calculator endpoint and UI.
- Implement day count/compounding calculations and trace generation.
- Add regression test vectors (leap year, month-end, tier boundary).

### Weeks 9–10: Batch + Results
- Implement batch calculation jobs and status polling.
- Build Accrual & Payout Results screen.
- Add export and pagination.

### Weeks 11–12: Reconciliation + Hardening + UAT
- Build reconciliation dashboard and variance handling.
- Security hardening (tenant rules, access controls, rate-limiting).
- UAT with pilot tenant, rollback rehearsal, go-live checklist.

---

## 8) Quality Gates (Definition of Done)

1. **Functional**
   - 100% pass for agreed interest calculation test pack.

2. **Security**
   - Tenant isolation verified at API and DB rule levels.
   - No cross-tenant reads via direct URL or query tampering.

3. **Auditability**
   - Every publish/approval/change has actor/time/before-after snapshot.

4. **Performance**
   - Preview calc p95 < 500ms for single account/31 days.
   - Batch throughput target defined and met in UAT.

5. **Non-impact**
   - Existing eMobility regression suite passes unchanged.
   - Feature flag off = zero user-visible changes in current portal.

---

## 9) Immediate Next Build Tasks (Week 1 backlog)

1. Add new `View` entries for the 8 banking screens.
2. Add fintech menu mapping entries behind `ENABLE_BANKING_INTEREST_MVP`.
3. Scaffold backend route group `/api/v1/banking-interest/*`.
4. Create entity interfaces and validation schemas.
5. Implement first vertical slice:
   - `Interest Products Manager` UI
   - `POST /products`, `GET /products`
   - tenant-safe persistence + audit.

This sequence delivers value quickly while keeping all existing eMobility functionality isolated and intact.

---

## 10) Calculator Invariants (UAT/Checker Reference)

The calculator preview is deterministic and must obey these rules for all tenants:

1. **Day-count conventions are explicit**
   - `ACT/360` uses $1/360$ per day.
   - `ACT/365F` uses $1/365$ per day.
   - `30E/360` applies end-of-month normalization and uses $\Delta/360$.

2. **Assignment `rateBookId` override has highest precedence**
   - If assignment includes `rateBookId`, that specific rate book is used.
   - If it does not exist, preview fails with a clear “no approved rate book” error.
   - Product/date-based fallback is used only when no explicit override exists.

3. **Promotional tier precedence**
   - For a given balance band, active promo tier (`promoFrom`/`promoTo`) is applied before standard tier.
   - Outside promo window, standard tier applies.

4. **Compounding behavior is product-driven**
   - `DAILY`: each day’s rounded interest is added to principal before next day.
   - `NONE`: principal remains static; accrual accumulates separately.

5. **Preview guardrails**
   - Max preview window is 366 days.
   - Start date must be on or before end date.
   - Principal must be non-negative and numeric.

6. **Explainability output is mandatory**
   - Trace row per day includes opening principal, applied rate, day fraction, day interest, and closing principal.
   - Exported CSV must match on-screen trace values.

These invariants are enforced in unit tests for the shared calculation service and should be used as UAT acceptance criteria.
