# CareCircle: Elderly Care & Medication Management Platform

> **Agent: read this whole file before writing any code.** It contains the problem, the researched decisions, the architecture, the build order and the rules. Produce an implementation plan first and wait for approval. Then build phase by phase.

---

## 0. Human setup checklist (do BEFORE the agent starts)

These steps need a human and some are slow, so start them first.

- [ ] AWS account with credentials configured locally (`aws configure` or SSO). Region: **ap-south-1 (Mumbai)**.
- [ ] Install **Node.js 22+**, **AWS SAM CLI**, **AWS CLI v2**, git.
- [ ] **SES:** create a verified sender identity (one email address is enough) and verify **every email address you will use in the demo** (elder, caretaker, family, judges' test address). New SES accounts start in sandbox mode and can only send to verified identities. Production access takes time, so do not rely on it today.
- [ ] **Bedrock:** open the Bedrock console and enable model access for the model in `BEDROCK_MODEL_ID` (section 6). Do this in the region you will call.
- [ ] Set an AWS Budget alert (e.g. $5) so nothing surprises you.
- [ ] Put this file at `docs/SPEC.md` in the repo and tell the agent to follow it.

---

## 1. Problem statement (from the hackathon)

Build a smart, interconnected healthcare management platform that helps elderly people manage daily medications, medical appointments and routines, while keeping family and caretakers informed.

Must-haves from the brief:

1. A **shared ecosystem** where the elder, caretakers and family access an elder's healthcare profile via **secure, passcode-based access**.
2. Authorized members can **view, add, edit and manage medication schedules**, **track adherence**, and **monitor upcoming doctor appointments**.
3. **Proactive email reminders** for missed medications, upcoming doses and appointments.
4. Go **beyond a basic reminder app**: smarter, more accessible, reliable and collaborative, with **the elder at the centre of healthcare decisions**.

---

## 2. Research summary and decisions

### 2.1 What makes this problem hard (and where to win)

| Failure of basic reminder apps | Our answer |
|---|---|
| A reminder fires once, nobody knows if the dose was taken | **Dose-event state machine** with escalation to caretaker, then family |
| The elder must open an app and log in | **One-tap confirm from the email link** (no login) and a giant "I took it" button |
| Caretakers silently override the elder | **Suggest, then approve** workflow plus a transparent **activity log** the elder can see |
| Typing prescriptions is tedious for elders | **Prescription photo scan** with AI extraction, always human-reviewed |
| Family gets noise, not insight | **Weekly adherence digest** written from real numbers |

### 2.2 Architecture options evaluated

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| A. EC2 / Elastic Beanstalk monolith (Express + RDS + node-cron) | Familiar | Cron lives on one server (missed reminders if it restarts), more ops, slower to deploy | Rejected |
| B. **Serverless: API Gateway + Lambda + DynamoDB + EventBridge Scheduler + SES + Bedrock** | No servers, scheduler is managed and reliable, near-zero cost at this scale, one SAM template deploys everything, strong "AWS-native" story | DynamoDB needs careful key design | **Chosen** |
| C. AWS Amplify Gen 2 full-stack | Fastest scaffolding | Heavy abstraction, harder for an agent to debug, less control over scheduling and email logic | Rejected (use Amplify **Hosting** only for the frontend) |
| D. ECS Fargate + RDS | Production-grade | Too slow to set up for a one-day build | Rejected |

### 2.3 Key service decisions (with evidence)

**Email: Amazon SES.**
- Every new SES account starts in the **sandbox** per Region, where you can only send to verified addresses and domains. Plan around this (checklist above). Sources: AWS SES FAQ; AWS Messaging blog on limit-increase and sandbox exit.
- Identities are **region-specific**: verify them in the same region the Lambda sends from.
- Fallback if SES setup blocks you: SMTP via Nodemailer behind the same `mailer` interface (see section 9).

**Scheduling: one recurring "ticker" via EventBridge Scheduler (every 1 minute) plus a state machine stored on each dose.**
- EventBridge Scheduler supports one-time, rate and cron schedules, time zones, retries and dead-letter queues. It scales far past what we need and costs essentially nothing for this workload. Verify current pricing in the AWS console.
- Alternative considered: creating one one-time schedule per dose. Rejected: recurring medications would create hundreds of schedules, and editing a medication means finding and deleting them all. A ticker that reads "what is due now" is simpler, idempotent and easy to demo.
- Scheduler cron expressions skip times that fall in a DST gap. India has no DST, so this does not affect us.

**Database: DynamoDB, single table, on-demand billing.** Everything is scoped to a care circle, which fits partition-by-circle perfectly. A sparse GSI makes "what needs action now" a cheap query.

**Auth: custom passcode auth with JWT** (not Cognito). The brief asks for passcode-based access, and invite codes plus hashed passcodes give us exactly that with far less setup. Cognito is a post-hackathon upgrade.

**AI: Amazon Bedrock Converse API** (multimodal). The Converse API accepts image input for vision-capable models such as Amazon Nova and Anthropic Claude through one unified interface. Used for prescription extraction and the weekly digest wording. AWS has published a two-model Converse pattern using Nova 2 Lite for cheap extraction with Claude for harder reasoning, so a cheap model first is a recognised approach.
- Model ID comes from env (`BEDROCK_MODEL_ID`). Default: `us.amazon.nova-2-lite-v1:0` (cross-region inference profile). Alternative: a Claude Sonnet profile. **Verify availability and access in the console** because model and region availability changes.
- Call Bedrock in `BEDROCK_REGION` (default `us-east-1`) even though the rest of the stack is in ap-south-1.

**Frontend hosting: AWS Amplify Hosting** (manual zip deploy of `frontend/dist`) or `npm run dev` locally if time is short.

### 2.4 Final decision

**Serverless on AWS (Option B)** with a React SPA. The reliability story (managed scheduler, escalation, idempotent state machine) is the strongest differentiator against "basic reminder apps".

---

## 3. Tech stack (fixed, do not substitute)

- **IaC / deploy:** AWS SAM (`template.yaml`), `sam build && sam deploy --guided`
- **Backend:** Node.js 22, TypeScript (SAM esbuild build), **Hono** on Lambda (`hono/aws-lambda`), **zod** validation, AWS SDK v3 (`@aws-sdk/lib-dynamodb`, `client-sesv2`, `client-bedrock-runtime`, `client-ssm`), `jose` (JWT and signed links), `bcryptjs`
- **Frontend:** Vite + React + TypeScript + Tailwind, React Router, TanStack Query, Recharts
- **Tests:** Vitest, only for the pure state machine and token signing

---

## 4. Architecture

```
React SPA (Amplify Hosting)
   |  HTTPS
API Gateway (HTTP API)  ---> Lambda "api" (Hono router)
                                 |-- DynamoDB (single table)
                                 |-- SES v2 (emails)
                                 |-- Bedrock (scan, digest wording)
EventBridge Scheduler
   |-- rate(1 minute) ---> Lambda "ticker"  (reads GSI, advances dose/appointment stages, sends emails)
   |-- cron weekly    ---> Lambda "digest"  (adherence stats + AI summary -> family email)
   |-- cron daily     ---> Lambda "ticker" with {task:"extend-horizon"} (materialise future doses)
```

**Principle: functional core, imperative shell.** The state machine is a pure function; Lambdas only do I/O around it.

---

## 5. Data model (DynamoDB single table `CareTable`)

Keys: `PK`, `SK`. One sparse GSI `GSI1` (`GSI1PK`, `GSI1SK`). Billing: on-demand. TTL attribute: `ttl`.

| Entity | PK | SK | Key fields |
|---|---|---|---|
| Circle | `C#{circleId}` | `META` | name, elderName, timezone (`Asia/Kolkata`), settings |
| Member | `C#{circleId}` | `M#{memberId}` | name, email, role (`ELDER` / `CARETAKER` / `FAMILY`), passcodeHash, notify prefs |
| Login lookup | `U#{email}` | `LOGIN` | circleId, memberId |
| Invite | `INV#{code}` | `META` | circleId, role, expiresAt, usedAt, `ttl` |
| Medication | `C#{circleId}` | `MED#{medId}` | name, strength, form, instructions, times[`HH:mm`], daysOfWeek[], startDate, endDate?, pillCount?, refillThreshold?, active |
| Dose event | `C#{circleId}` | `D#{dueAtISO}#{medId}` | medId, medName, dueAt, status, nextActionAt, takenAt?, takenBy?, `GSI1PK="OPEN"` while open, `GSI1SK=nextActionAt` |
| Appointment | `C#{circleId}` | `A#{startsAtISO}#{apptId}` | doctor, place, notes, startsAt, stage, nextActionAt, `GSI1PK="OPEN"`, `GSI1SK=nextActionAt` |
| Suggestion | `C#{circleId}` | `S#{createdAtISO}#{id}` | type, payload, proposedBy, status (`PENDING` / `APPROVED` / `DECLINED`), decidedBy |
| Activity | `C#{circleId}` | `L#{createdAtISO}#{id}` | actorId, action, summary (no sensitive extras) |
| Login attempts | `U#{email}` | `ATTEMPTS` | count, `ttl` (lockout window) |

Remove `GSI1PK`/`GSI1SK` from an item when it reaches a terminal state, so the GSI only holds open work.

**Circle settings (defaults):** `preMinutes=10`, `escalate1Minutes=15` (caretakers), `escalate2Minutes=30` (family), `missedMinutes=60`, `appointmentReminders=[1440, 120]` (minutes before). **Demo mode** overrides to `pre=0, e1=1, e2=2, missed=3` so a judge can watch the full escalation within about three minutes.

---

## 6. Core logic

### 6.1 Dose lifecycle (pure function, unit-tested)

```
SCHEDULED --(now >= due - pre)--------> REMINDED     email elder (+ optional push of link)
REMINDED  --(now >= due + e1)---------> ESCALATED_1  email caretakers
ESCALATED_1 --(now >= due + e2)-------> ESCALATED_2  email family (+ caretakers again)
ESCALATED_2 --(now >= due + missed)---> MISSED       final "missed" notice, adherence counts it
any open  --(user marks taken/skipped)-> TAKEN / SKIPPED (terminal)
```

- `nextStage(dose, settings, now) -> { next?: Dose, emails: EmailIntent[] }` is **pure**. The ticker applies it with a **conditional write** (`status = :expected`) so retries and overlapping ticks never send duplicate emails.
- Each transition sets the new `nextActionAt`. Terminal states drop the GSI keys.

### 6.2 Materialising doses

- On medication create or edit: delete future `SCHEDULED` doses for that med, then generate doses for the next **7 days** in the circle's timezone (use a timezone-aware date lib; store `dueAt` as UTC ISO).
- Daily `extend-horizon` task tops up to 7 days ahead for all active meds.
- Editing never rewrites history: only future, untouched doses are regenerated.

### 6.3 Ticker (`rate(1 minute)`)

1. Query `GSI1` where `GSI1PK="OPEN"` and `GSI1SK <= now` (paginate).
2. For each item, run the pure transition for doses or appointments.
3. Conditional write, then send email through `mailer`. If sending fails, log it and leave `nextActionAt` for retry (cap retries).

### 6.4 Appointments

Same pattern: stages `SCHEDULED -> REMIND_24H -> REMIND_2H -> DONE`, recipients are elder plus caretakers (family optional by preference).

### 6.5 One-tap confirm from email

- Each reminder email contains **"I took it"** and **"Skip"** links with a signed, expiring token (HMAC/JWT via `jose`, contains `doseId`, `circleId`, `action`, `exp`).
- `GET /p/confirm?t=` renders a small confirmation page; the button on it does `POST /p/confirm`. **Never mutate on GET**, because email security scanners prefetch links and would mark doses taken by accident.
- Tokens are single purpose and expire (e.g. after dose due time plus 6 hours).

### 6.6 Roles and permissions

| Action | ELDER | CARETAKER | FAMILY |
|---|---|---|---|
| View meds, doses, appointments, adherence, activity | yes | yes | yes |
| Mark dose taken / skipped | yes | yes (on behalf, logged) | no |
| Add / edit / delete meds and appointments directly | yes | yes | no |
| Submit a suggestion (new med, change, appointment) | yes | yes | **yes** |
| Approve / decline suggestions | **yes (primary)** | yes | no |
| Create invite codes, change circle settings | no | yes (owner) | no |
| Receive escalations | no | yes | yes (level 2 and digest) |

Every create, edit, delete, approval and "taken on behalf" writes an **Activity** item. The elder's home screen shows recent activity, which keeps the elder informed and in control.

### 6.7 Prescription scan (AI, human-in-the-loop)

- `POST /scan/prescription` with a client-compressed JPEG (target under 1.5 MB, sent base64; Lambda sync payload limit is 6 MB).
- Lambda calls Bedrock Converse with the image and a strict prompt: return **only JSON** matching a zod schema (`name`, `strength`, `form`, `frequency`, `times[]`, `durationDays?`, `instructions?`, `confidence`). Strip markdown fences, validate with zod, discard anything invalid.
- The UI shows an **editable review form**. **Nothing is saved until the user confirms.** Show a visible note: "Check against the label. AI can make mistakes."
- Never provide dosage advice. Extraction only.

### 6.8 Weekly digest

- Cron weekly, Lambda computes per-medication adherence **deterministically** (taken, skipped, missed counts).
- Bedrock only rewrites those numbers into 3 to 4 friendly sentences. The prompt must forbid adding facts not in the JSON. Fall back to a plain template if Bedrock fails.
- Sent to family and caretakers.

---

## 7. API surface

All JSON. Auth: `Authorization: Bearer <jwt>` (claims: `memberId`, `circleId`, `role`). Validate every body with zod. Return `{ error: { code, message } }` on failure.

| Method and path | Role | Purpose |
|---|---|---|
| `POST /auth/circles` | public | Create circle + first caretaker (owner). Returns token |
| `POST /auth/join` | public | `inviteCode`, name, email, passcode. Role comes from the invite |
| `POST /auth/login` | public | email + passcode. Lockout after 5 failures per 15 min |
| `GET /me`, `GET /circle` | any | Profile, members, settings |
| `PATCH /circle/settings` | caretaker | Escalation delays, demo mode, timezone |
| `POST /circle/invites` | caretaker | `{role}` -> `{code, expiresAt}` (48 h) |
| `GET/POST /meds`, `PATCH/DELETE /meds/:id` | elder, caretaker | Medication CRUD (delete = deactivate) |
| `GET /doses?date=YYYY-MM-DD` | any | Doses for a day |
| `POST /doses/:id/take`, `/skip` | elder, caretaker | Mark dose |
| `GET /adherence?days=7` | any | Per-day and per-med stats |
| `GET/POST /appointments`, `PATCH/DELETE /appointments/:id` | elder, caretaker | Appointment CRUD |
| `GET/POST /suggestions`, `POST /suggestions/:id/approve` and `/decline` | see matrix | Suggest and approve flow |
| `GET /activity` | any | Recent change log |
| `POST /scan/prescription` | elder, caretaker | AI extraction (draft only) |
| `GET /p/confirm`, `POST /p/confirm` | signed token | One-tap email confirm |
| `POST /demo/seed`, `POST /demo/trigger-missed` | only if `DEMO_MODE=true` | Demo helpers |

---

## 8. Frontend spec

**Pages:** Login/Join, **Today**, Medications, Appointments, Adherence, Suggestions, Activity, Settings (members, invites, escalation, demo mode).

**Elder mode (when role is ELDER) is a different, simpler UI:**
- Three nav items maximum: **Today**, **Appointments**, **Ask / Suggestions**.
- Base font 20px or larger, buttons at least 56px tall, high-contrast palette, plain language, no icons without text labels.
- Today shows one **hero card**: next dose, time, medicine name, big **"I took it"** and **"Skip"** buttons, then the rest of the day below.
- **Read aloud** button using the browser `speechSynthesis` API.
- Pending suggestions appear as plain yes/no cards: "Your daughter suggests adding Vitamin D at 9 AM. Approve?"

**Caretaker and family views:** dense but clean: weekly adherence chart (Recharts), per-medication adherence, missed-dose list, upcoming appointments, activity feed.

**Quality bar:** responsive (phones first), loading and empty states on every page, no dead buttons, accessible labels and keyboard focus.

---

## 9. Project structure and conventions

```
carecircle/
  template.yaml                 # SAM: HTTP API, 3 Lambdas, DynamoDB, Scheduler, IAM, SSM param
  docs/SPEC.md
  backend/
    src/
      handlers/                 # thin entrypoints: api.ts, ticker.ts, digest.ts
      routes/                   # auth, circle, meds, doses, appointments, suggestions, scan, public
      domain/                   # PURE logic: doseStateMachine.ts, scheduleGenerator.ts, adherence.ts, permissions.ts
      services/                 # I/O wrappers: mailer.ts, ai.ts, tokens.ts, activity.ts
      db/                       # client.ts, keys.ts, repos (one file per entity)
      lib/                      # config.ts, errors.ts, time.ts, validate.ts
    test/                       # vitest: domain/* and tokens
  frontend/
    src/ { pages, components, features/elder, api, hooks, lib }
  scripts/seed.ts               # demo data (grandmother, son, nurse, daughter)
```

**Code rules (important):**
- Compact, functional code. Small pure functions. No classes unless unavoidable.
- **Strict separation of concerns:** routes parse and authorise, `domain/` decides, `services/` and `db/` do I/O. Domain code never imports AWS SDKs.
- `mailer` is an interface (`send(intent)`), with an SES implementation and an SMTP fallback implementation chosen by env.
- Config only via env and SSM. **No secrets in code or git.** JWT secret is stored in SSM Parameter Store (SecureString) and read once per cold start.
- Passcodes hashed with bcrypt (cost 10). Never log passcodes, tokens or full email bodies.
- Least-privilege IAM per Lambda using SAM policy templates. Bedrock permission only on the `api` and `digest` Lambdas.
- Minimal personal health info in emails: medication name and time only; no diagnosis or notes. Emails are not a secure channel.
- Comments only where the "why" is not obvious.

**Environment variables:** `TABLE_NAME`, `SES_FROM`, `APP_URL`, `API_URL`, `JWT_PARAM_NAME`, `BEDROCK_REGION`, `BEDROCK_MODEL_ID`, `MAIL_DRIVER` (`ses` | `smtp`), `DEMO_MODE`.

---

## 10. Build order (stop after each phase, run the checks, commit)

| Phase | Deliverable | Definition of done |
|---|---|---|
| 0 | Repo, SAM template skeleton, `GET /health`, deployed to ap-south-1 | `curl` the deployed URL returns 200. Confirms credentials and region work |
| 1 | Auth: create circle, invite, join, login, JWT middleware, permissions | Three roles can log in; wrong passcode x5 locks out; role matrix enforced by tests |
| 2 | Medications CRUD + dose materialisation + Today view | Adding a med creates 7 days of doses; elder can tap "I took it" |
| 3 | **Ticker + state machine + SES emails + escalation + one-tap confirm** | In demo mode a missed dose triggers elder, caretaker, then family emails; no duplicates across overlapping ticks; vitest covers every transition |
| 4 | Appointments + reminders | 24 h and 2 h emails fire; appointment list on dashboards |
| 5 | Suggestions + approvals + Activity log | Family suggestion appears for the elder, approval creates the medication, everything logged |
| 6 | Adherence charts + refill alert | Weekly chart renders from real data; low pill count shows a warning and emails caretakers |
| 7 | Prescription scan | Photo -> editable draft -> confirm -> saved; invalid AI output handled gracefully |
| 8 | Weekly digest, demo seed script, elder UI polish (read aloud), README | `npm run seed` gives a full demo story; README has deploy steps |

**Priority if time runs out:** P0 = phases 0 to 3. P1 = phases 4, 5. P2 = phases 6 to 8 (scan is the best P2 for the demo).

---

## 11. Risks and fallbacks

| Risk | Fallback |
|---|---|
| SES still in sandbox or sender not verified | Verify all demo recipients. If blocked, switch `MAIL_DRIVER=smtp` (Nodemailer with an app password) |
| Bedrock model access not enabled in time | Scan endpoint returns `501`, UI hides the Scan button, manual entry unaffected |
| Deploy problems close to the demo | Run frontend locally (`npm run dev`) against the deployed API, or run the API locally with `sam local start-api` |
| Ticker sends duplicates | Conditional writes on status (already specified); add an idempotency key to the email intent |
| Time zone bugs | Store UTC, compute day boundaries with the circle timezone, and test around midnight |

---

## 12. Demo script (design the product so this works)

1. Show the seeded circle: Grandmother (ELDER), Son (CARETAKER), Nurse (CARETAKER), Daughter (FAMILY).
2. Daughter **suggests** a new vitamin. Grandmother sees a big yes/no card and approves it. Activity feed shows who did what.
3. Caretaker **scans a prescription photo** and the draft schedule appears. Edit, confirm, saved.
4. Turn on demo mode and press `trigger-missed`. Show emails arriving in order: reminder to the elder, escalation to the caretaker, then to the family.
5. Tap **"I took it"** from the email on a phone (no login) and show the dose flip to Taken everywhere.
6. Close on the weekly adherence digest and the "elder stays in control" message.

---

## 13. Out of scope (do not build)

Native mobile apps, SMS or WhatsApp, payments, real EHR integration, medical advice or dosage recommendations, drug-interaction checking (too risky and unverifiable for a one-day build), multi-circle switching for one email.

> **Disclaimer to show in the UI footer:** CareCircle helps organise routines. It is not medical advice. Always follow your doctor's instructions.

---

## 14. Sources consulted (verify details in the AWS console, since limits, pricing and model availability change)

- AWS SES FAQ: https://aws.amazon.com/ses/faqs/ (sandbox restricts sending to verified identities; sending limits)
- AWS Messaging blog on SES limit increase and sandbox exit: https://aws.amazon.com/blogs/messaging-and-targeting/ses-limit-increase-form-consolidation/
- AWS Builder Center, EventBridge Scheduler for scheduled jobs: https://builder.aws.com/content/3KlUsGddUtlTJTEihmtO40vu6MG/free-aws-cron-jobs-eventbridge-scheduler-and-step-functions
- Overview of Scheduler one-time and recurring schedules, time zones and retries: https://kindatechnical.com/serverless-architecture/building-a-serverless-cron-job-with-eventbridge.html
- Bedrock Converse API with image input (Nova and Claude) and the two-model document pattern: https://aihub.hkuspace.hku.hk/?p=7212 (mirror of an AWS Machine Learning blog post)
