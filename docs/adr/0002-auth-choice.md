# ADR 0002: Authentication Architecture, OTP Password Reset, and RBAC Pattern Selection

- **Status**: Accepted
- **Date**: 2026-09-26
- **Authors**: Antigravity AI & StockSense Engineering
- **Context**: StockSense Phase 4a (Authentication, OTP password reset, and RBAC)

---

## 1. Context and Problem Statement

`architecture.md` Section 10 (Security Architecture) defines the authentication and authorization requirements for StockSense:

1. Short-lived JWT access tokens (~15 min TTL) + rotating refresh tokens stored in `httpOnly` secure cookies.
2. Refresh-token-reuse detection that revokes the whole token family upon replay of a consumed or revoked token.
3. 6-digit numeric OTP for password reset (5–10 min TTL), hashed at rest in `otp_codes` (never stored in plaintext), single-use (`consumed_at`), and hard rate-limited.
4. Two-role RBAC model (`INVENTORY_MANAGER`, `WAREHOUSE_STAFF`).
5. Swappable transactional email provider abstraction (dev console logger for local development, swappable for SendGrid/SES/Postmark).
6. Security hardening via Helmet headers, global and route-specific rate limiting (`@nestjs/throttler`), and class-validator DTOs.

We evaluated two candidate reference repositories:

- `andrechristikan/ack-nestjs-boilerplate` (NestJS v11/12, JWT, OTP, RBAC, Repository Pattern, multi-tenant workspace architecture)
- `jaleeldgk/nestjs-auth` (NestJS, JWT, Prisma ORM, Nodemailer OTP, RBAC, Helmet, rate limiting)

---

## 2. Reference Repository Evaluation

### 2.1 `andrechristikan/ack-nestjs-boilerplate`

- **Strengths**:
  - Highly detailed documentation of decorator ordering conventions across stacked guards.
  - Strict security posture regarding token family tracking and audit trail logging.
- **Weaknesses / Architectural Impediments**:
  - Extreme dependency footprint: pulls in 40+ external packages including `@casl/ability`, `@aws-sdk/*`, MongoDB/BSON types, Vault integrations, Sentry profiling, and custom workspace/project abstractions.
  - Tightly coupled to custom abstract repository base classes that duplicate Prisma Client features.
  - Adopting the full boilerplate would create the exact "Frankenstein" bloated dependency graph warned against in `architecture.md` Section 8.

### 2.2 `jaleeldgk/nestjs-auth`

- **Strengths**:
  - Direct alignment with our chosen stack: NestJS + Prisma ORM + JWT + Nodemailer/email abstraction + class-validator DTOs.
  - Lean dependency footprint without unnecessary cloud or multi-tenancy SDKs.
  - Directly matches our PostgreSQL `User` and `Role` enum schema.
  - Easy to extend with custom token rotation logic and security headers.

---

## 3. Decision: Targeted Adaptation of `jaleeldgk/nestjs-auth` with ACK Decorator Conventions

We selected the **`jaleeldgk/nestjs-auth` architectural pattern** as the primary foundation, while harvesting the **strict guard ordering conventions and token family reuse detection semantics** from `ack-nestjs-boilerplate` and `architecture.md`.

### Key Implementation Decisions:

1. **Lightweight Dependency Footprint**:
   - Integrated `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcryptjs`, `cookie-parser`, `helmet`, `@nestjs/throttler`, `class-validator`, and `class-transformer`.
   - Avoided heavy multi-tenant or cloud SDK bloat.

2. **Database-Backed Refresh Token Families (`refresh_tokens` Table)**:
   - Added `RefreshToken` model to `backend/prisma/schema.prisma` mapping to `refresh_tokens`.
   - Each token family is identified by a unique `family` UUID.
   - On rotation (`POST /api/v1/auth/refresh`), the old token is marked `isRevoked: true` and a new token is created in the same family.
   - **Reuse Detection**: If an incoming refresh token is already revoked, an attacker may have intercepted the old token. The system immediately revokes all tokens matching `family`, clears the client cookie, and returns `401 Unauthorized`.

3. **Hashed-At-Rest Single-Use OTP Codes**:
   - Generated as 6-digit cryptographically secure numeric codes (`crypto.randomInt(100000, 1000000)`).
   - Invariant: Plaintext OTP is **never** stored in the database.
   - Hashed using `bcrypt` before writing to `otp_codes.code_hash`.
   - Configured with a 10-minute TTL.
   - Upon verification (`POST /api/v1/auth/otp/verify-reset`), the record is marked `consumed_at = now()`. Replaying the same code fails immediately.
   - Per-user and per-IP rate limiting enforces a maximum of 3 OTP requests within a 5-minute window, backed by `@Throttle({ default: { limit: 5, ttl: 300000 } })`.

4. **Swappable Email Provider Abstraction**:
   - Implemented `EmailProvider` interface (`sendEmail()`).
   - Default provider: `ConsoleEmailProvider` (`EMAIL_PROVIDER=console`), which formats and logs simulated emails to standard output for local developer testing.
   - Extensible `SmtpEmailProvider` (`EMAIL_PROVIDER=smtp`) ready for production SMTP / transactional mailers.

5. **RBAC Guard Ordering Convention**:
   - Adopted the bottom-up guard execution convention:
     - `@Roles(...)`: declares metadata required for authorization.
     - `@UseGuards(JwtAuthGuard, RolesGuard)`: `JwtAuthGuard` authenticates the token and attaches `req.user`, followed immediately by `RolesGuard` evaluating `req.user.role` against permitted roles.
     - Route handlers use `@CurrentUser()` to extract validated caller identity.
     - Public routes explicitly declare `@Public()` to bypass JWT enforcement.

---

## 4. Consequences

- **Positive**: Clean, maintainable codebase that builds and tests fast (`< 6s` unit test execution).
- **Positive**: Strict OWASP compliance with refresh token reuse detection and hashed-at-rest single-use OTPs.
- **Positive**: No unnecessary external cloud dependencies required for local development or testing.
- **Negative**: Email dispatch in local dev requires inspecting console logs or setting up an SMTP sandbox (e.g. Mailhog), which is standard practice for local development.
