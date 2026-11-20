# Security Architecture & Threat Model

**Project:** Personal Stock Market Assistant (Stokiffy)  
**Document:** Security Architecture, Authentication & Compliance  
**Status:** Approved Architectural Baseline  
**Version:** 1.0.0  
**Date:** November 2026  
**Audience:** Security Architects, Backend Engineers, DevOps, Lead Developers  

---

## 1. Security Philosophy & Threat Model

Although initially deployed for personal investment research, the platform deals with sensitive financial data, portfolio positions, proprietary investment theses, and trade plans. The system is engineered to enterprise security standards from day one to guarantee:
- **Confidentiality:** Portfolio allocations, watchlists, trade journals, and financial notes are strictly accessible only by the verified user.
- **Integrity:** Financial calculations, historical snapshots, and rule-set versions are tamper-proof and mathematically reproducible.
- **Auditability:** Every human override, trade plan modification, and rule publication is recorded in an immutable audit ledger.

### Threat Matrix & Defensive Countermeasures

| Threat Vector | Attack Scenario | Architectural Countermeasure |
| :--- | :--- | :--- |
| **BOLA / IDOR** | Attacker tampers with `companyId` or `tradePlanId` in URL to view another user's research or portfolio | Mandatory multi-tenant row-level ownership checks (`WHERE userId = session.userId`) enforced at repository layer |
| **Input Manipulation** | Attacker inputs negative prices, division-by-zero P/E ratios, or string overflows | Strict Zod validation on every API route handler; rejection of NaN, Infinity, negative risk percentages |
| **Token Theft & Session Hijacking** | XSS script steals user authentication session | Web uses `HttpOnly`, `SameSite=Strict`, `Secure` cookies; mobile uses short-lived JWTs (15 min) with rotating refresh tokens |
| **Data Provenance Tampering** | Retrospective alteration of past financial analysis to fabricate trading performance | Immutable `analysis_runs` and `audit_events` tables; updates to historical analysis runs are rejected at the DB constraint level |
| **Denial of Service / Resource Exhaustion** | Heavy DCF sensitivity calculations or massive CSV uploads flood the server | Token bucket rate limiting via edge middleware; file size limits (10MB max); asynchronous processing in background worker |
| **Credential Leakage** | Database passwords or LLM API keys committed to repository or leaked to client bundle | `packages/config` secret linting; strict separation of server `.env` vs `NEXT_PUBLIC_` prefixes |

---

## 2. Authentication Architecture: Dual-Client Support

To support both the current **Next.js Web Application** and future **Native Mobile Applications (Flutter / React Native)** without compromising security, the system implements a hybrid authentication model:

```
                  ┌────────────────────────────────────────┐
                  │           Client Applications          │
                  └───────────┬────────────────┬───────────┘
                              │                │
            Browser Web App   │                │   Native Mobile App
      (SameSite Strict Cookie)│                │   (Authorization: Bearer <JWT>)
                              ▼                ▼
                  ┌────────────────────────────────────────┐
                  │    Unified API Gateway (/api/v1/*)     │
                  │                                        │
                  │  ┌──────────────────────────────────┐  │
                  │  │   Auth Middleware Inspector      │  │
                  │  │                                  │  │
                  │  │ 1. Check HttpOnly Session Cookie │  │
                  │  │    (Auth.js Decryption)          │  │
                  │  │                                  │  │
                  │  │ 2. If no cookie, inspect         │  │
                  │  │    Authorization: Bearer <JWT>   │  │
                  │  │    (Verify RS256 Signature)      │  │
                  │  └──────────────────┬───────────────┘  │
                  └─────────────────────┼──────────────────┘
                                        │ Authenticated User Context { userId, role }
                                        ▼
                  ┌────────────────────────────────────────┐
                  │      Protected Route Handlers          │
                  └────────────────────────────────────────┘
```

### 2.1. Web Client Authentication (Auth.js)
- Session mechanism: Encrypted JWE (JSON Web Encryption) stored in an `HttpOnly`, `SameSite=Strict`, `Secure` cookie.
- CSRF Protection: Next.js Route Handlers validate the `Origin` and `Host` headers on all state-changing HTTP verbs (POST, PATCH, DELETE).

### 2.2. Future Mobile Client Authentication (JWT Bearer Strategy)
- Mobile clients obtain an access token via `POST /api/v1/auth/token`.
- **Access Token:** Short-lived JWT (15-minute expiration) signed using asymmetric RS256 or Ed25519 private keys. Includes standard claims: `sub` (userId), `iat`, `exp`, `iss` (`stock-assistant-api`), and `aud` (`stock-assistant-mobile`).
- **Refresh Token:** Long-lived, cryptographically secure opaque token (stored as SHA-256 hash in `refresh_tokens` database table) with automatic token rotation upon each refresh.

---

## 3. Authorization & Row-Level Ownership

Every resource query and mutation strictly enforces tenant isolation:

```ts
// packages/db/src/repositories/trade-plan-repository.ts
export class TradePlanRepository {
  async getById(planId: string, userId: string): Promise<TradePlan | null> {
    // userId is ALWAYS part of the compound lookup
    return prisma.tradePlan.findFirst({
      where: {
        id: planId,
        userId: userId, // Guarantees tenant isolation
        deletedAt: null,
      },
    });
  }
}
```

Rules:
- API routes extract `userId` exclusively from the verified server session/token—never from client request parameters, headers, or query strings.
- Admin endpoints (e.g., publishing global sector benchmarks or system rule sets) require an explicit role verification check (`user.role === 'SYSTEM_ADMIN'`).

---

## 4. Input Validation & Mathematical Sanitization

All incoming network payloads pass through strict Zod schemas before touching application or domain code:

```ts
// packages/contracts/src/api/trade-plans.ts
import { z } from 'zod';

export const CreateTradePlanSchema = z.object({
  companyId: z.string().cuid2(),
  entryPrice: z.number().positive('Entry price must be greater than zero').finite(),
  stopPrice: z.number().positive('Stop price must be greater than zero').finite(),
  riskPercentage: z.number().min(0.1).max(5.0, 'Risk percentage must not exceed 5% of portfolio'),
  thesis: z.string().min(20, 'Thesis must contain at least 20 characters of evidence').max(5000),
  invalidationCondition: z.string().min(10, 'Invalidation trigger is required').max(2000),
}).refine((data) => data.stopPrice < data.entryPrice, {
  message: 'Stop price must be strictly lower than entry price for a long investment thesis',
  path: ['stopPrice'],
});
```

Defensive Math Controls:
- **Zero Divisor Guard:** Ratios (P/E, PEG, Debt/Equity) verify that denominators are non-zero before calculation. If EPS is zero or negative, the result is classified as `N/M` (Not Meaningful), never `Infinity`.
- **Arbitrary Precision:** All currency calculations use `Decimal.js` to eliminate float inaccuracy.

---

## 5. Audit Logging & Non-Repudiation

To preserve scientific rigor and investment discipline, all thesis edits, risk overrides, and manual transactions are permanently recorded in an append-only `audit_events` table:

```sql
CREATE TABLE audit_events (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id),
    action VARCHAR(64) NOT NULL,            -- e.g. "FLAG_OVERRIDE", "TRADE_PLAN_CREATED"
    entity_type VARCHAR(64) NOT NULL,       -- e.g. "AnalysisRun", "TradePlan"
    entity_id VARCHAR(32) NOT NULL,
    before_state JSONB,                     -- Snapshot prior to modification
    after_state JSONB,                      -- Snapshot after modification
    reason TEXT NOT NULL,                   -- Compulsory human explanation
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

Database Triggers & Constraints:
- `audit_events` has no `UPDATE` or `DELETE` permissions granted to the application database user.

---

## 6. Secrets Management & Environment Security

1. **Hierarchy of Environment Files:**
   - `.env.example`: Committed template documenting all required variables with placeholder values.
   - `.env.local`: Ignored by git; stores development credentials.
   - Production secrets: Injected via secure cloud secret manager (AWS Secrets Manager / Doppler / Infisical).
2. **Client Leaks Prevention:**
   - Only variables explicitly prefixed with `NEXT_PUBLIC_` are exposed to client-side bundles.
   - Database connection strings, Auth.js secret keys, and JWT private keys must never use `NEXT_PUBLIC_`.
   - CI pipeline includes automated secret scanning using `trufflehog` / `git-secrets`.

---

## 7. HTTP Security Headers & Transport Security

Next.js edge middleware applies standard defensive HTTP headers:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (Force TLS 1.3)
- `X-Content-Type-Options: nosniff` (Prevent MIME-type sniffing)
- `X-Frame-Options: DENY` (Clickjacking prevention)
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self';`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
