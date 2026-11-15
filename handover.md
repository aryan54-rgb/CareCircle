# CareCircle: Project Handover & Context Document

> **Date:** November 15, 2026  
> **Status:** Production-Ready & Feature-Complete (All P0, P1, P2, P3 tiers verified)  
> **Repository:** [https://github.com/aryan54-rgb/CareCircle.git](https://github.com/aryan54-rgb/CareCircle.git)  
> **Branch:** `main` (Latest commit: `bf5f71e`)  

---

## 1. Project Summary & Architecture

**CareCircle** is an elderly care and medication safety platform. It combines:
- An **elder-first frontend** with large typography, speech synthesis read-aloud (English, Hindi, Marathi), and high-contrast touch targets.
- A **multi-tiered dose escalation state machine**: `SCHEDULED` ➔ `REMINDED` (elder) ➔ `ESCALATED_1` (caretakers) ➔ `ESCALATED_2` (family) ➔ `MISSED`.
- **One-tap confirm links** sent via Amazon SES emails with cryptographic tokens (GET landing page safe against crawlers, POST mutation).
- **Multimodal AI prescription scan** using Amazon Bedrock with confidence-aware review and manual safety verification.
- **Family collaboration workflow:** "Suggest, Then Approve" (family suggests, elder/caretaker approves).

### Architecture Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Recharts (Hosted on Vercel)
- **Backend Framework:** Hono on AWS Lambda (Node.js 22 LTS, ES Modules)
- **Database:** Amazon DynamoDB Single-Table Design (`carecircle-dev-table`) with sparse index `GSI1` for open tasks (`GSI1PK="OPEN"`, `GSI1SK=nextActionAt`)
- **Infrastructure as Code:** AWS SAM (`template.yaml`) in `ap-south-1` (Mumbai)
- **Scheduled Tasks:** Amazon EventBridge (1-minute ticker for GSI1 evaluations, daily horizon extension, weekly digest)
- **Email:** Amazon SES v2
- **AI / LLM:** Amazon Bedrock Converse API (`us.amazon.nova-2-lite-v1:0` via cross-region inference)

---

## 2. Live Cloud Endpoints & Resources

| Service | Target / Value |
| :--- | :--- |
| **AWS Region** | `ap-south-1` (Mumbai) |
| **API Gateway HTTP API** | `https://odu8ihixga.execute-api.ap-south-1.amazonaws.com` |
| **DynamoDB Table** | `carecircle-dev-table` |
| **SSM JWT Secret Parameter** | `/carecircle/jwt-secret-v2` (`SecureString`) |
| **SES Outbound Identity** | Configured via SAM parameter `SesFrom` |
| **App Frontend URL** | Configured via SAM parameter `AppUrl` (Vercel domain) |
| **Bedrock Region / Model** | `us-east-1` / `us.amazon.nova-2-lite-v1:0` |

---

## 3. Work Completed in This Sprint

### P0: Real Bugs & Security (Commit `9e0228a`)
1. **SSM JWT Secret:** Removed hardcoded secrets from `template.yaml` and `scripts/test-phase3.ts`. Migrated to `/carecircle/jwt-secret-v2` (`SecureString`). `backend/src/lib/config.ts` throws strictly if SSM lookup fails (no fallback).
2. **Email Config & Ticker Safeguard:** Removed hardcoded `SES_FROM` and `APP_URL` from SAM template. Refactored `ticker.ts` to send emails one recipient at a time (mitigating SES sandbox multi-recipient batch drops). Added retry logic that reverts dose status if all sends fail, with a 3-retry cap before advancing. Added `ses:GetAccount` and `ses:GetEmailIdentity` to IAM roles.
3. **Appointment Reminders:** Added pure `nextAppointmentStage` function (`backend/src/domain/appointmentStateMachine.ts`) with stages `SCHEDULED ➔ REMIND_24H ➔ REMIND_2H ➔ DONE`. Unit tested with 6 Vitest tests. Added ticker handler for `A#` items; drops GSI1 keys upon reaching `DONE`. Added appointment reminder email template in `mailer.ts`.
4. **AI Scan Honesty:** Removed the hardcoded "Amoxicillin" fallback in `services/ai.ts`. Now returns clean 503 `SERVICE_UNAVAILABLE` on Bedrock failures. The frontend modal displays *"Scan unavailable, enter manually"* while keeping manual entry working.
5. **HTML Injection Protection:** Created `backend/src/lib/html.ts` with `escapeHtml` for all user-controlled values in `mailer.ts` and `routes/public.ts`. Script tags pass data safely via JSON and `textContent`.
6. **Extend-Horizon & Weekly Digest:**
   - `handleDailyExtendHorizon` in `ticker.ts` tops up active medications to 7 days ahead using conditional puts (`attribute_not_exists(PK)`) so historical doses are never overwritten. Unit tested in `extendHorizon.test.ts`.
   - `digest.ts` scans circles (`SK = META`), computes 7-day adherence, calls `aiService.generateWeeklyWording` (with plain fallback), and emails members. Added manual trigger `POST /demo/digest`.
7. **Security & Seeding Hardening:** Moved seed logic into `backend/src/services/demoSeed.ts`. Added `POST /demo/reset` (CARETAKER and DEMO_MODE only, touches only `demo-circle`). Replaced `Math.random` with `crypto.randomUUID()` and `crypto.randomInt()`. Rate-limited `POST /auth/join`. Passcode minimum length enforced to 6. Added `@types/aws-lambda`.

### P1: Demo Reliability (Commit `782c6fb`)
8. **Notification Center:** Created `backend/src/db/repos/notifRepo.ts` storing every notification attempt with a 7-day TTL (`PK: C#{circleId}, SK: NOTIF#{time}#{id}`). Added `GET /circle/notifications` (Caretaker only) and an in-app "Notifications" tab in `CaretakerView.tsx` showing sent status, error logs, and stage transitions.
9. **Escalation Timeline Stepper:** Added a live stepper (`Elder Reminded ➔ Caretaker Alerted ➔ Family Alerted ➔ Missed`) with real-time countdown timers and 10-second polling on the Caretaker dashboard.
10. **Demo Reset Controls:** Connected `POST /demo/reset` to the top navigation header and Settings tab in `CaretakerView.tsx`.
11. **Deep Health Check:** Added `GET /health/deep` checking DynamoDB read/write, SES account sending status, and Bedrock Converse access (cached for 5 minutes). Added a status diagnostic panel in the Caretaker Settings tab.

### P2 & P3: Winning Differentiators & Polish (Commit `bafd9f0`)
12. **Peace of Mind Banner:** Added top banner on Caretaker and Family dashboards displaying real-time status (*"All doses on track today"*, *"Dose pending since..."*, or *"Dose MISSED"*) along with the **Weekly Care Score** percentage.
13. **Elder Multilingual Switcher:** Created `frontend/src/features/elder/translations.ts` supporting **English, Hindi (हिंदी), and Marathi (मराठी)**. Localized Elder view labels, buttons, appointments, suggestions, and voice read-aloud (`speechSynthesis.speak(..., t.langCode)`).
15. **Confidence-Aware AI Scan Review:** Added amber confidence badges on Bedrock-extracted fields and a mandatory physical verification safety checkbox (*"I have physically verified the label against the bottle"*) before the save button unlocks.
17. **Accessibility Pass:** 60px+ touch targets on all elder actions, high-contrast text and border treatments, focus rings, and explicit button labels.
18. **README Polish:** Updated [README.md](README.md) with GitHub-rendered Mermaid diagrams for system architecture and the dose escalation state machine, plus honest architectural trade-offs.
19. **Feature Walkthrough Guide:** Created [docs/DEMO.md](docs/DEMO.md) with the end-to-end testing playbook, feature verification steps, operational notes, and account credentials.
20. **Cleanup & Deployment:** Deleted the 14.8 MB `OfficialCommunityDeck.pptx` from Git. Updated `index.html` title, description, and OpenGraph metadata. Configured `vercel.json` and `frontend/vercel.json` for monorepo SPA deployment.

---

## 4. Test & Verification Results

All tests pass 100% cleanly:
```powershell
# Backend Vitest Suite (25/25 passing)
cd backend ; npm test

 ✓ test/appointmentStateMachine.test.ts (6 tests)
 ✓ test/permissions.test.ts (4 tests)
 ✓ test/adherence.test.ts (1 test)
 ✓ test/extendHorizon.test.ts (2 tests)
 ✓ test/scheduleGenerator.test.ts (3 tests)
 ✓ test/doseStateMachine.test.ts (6 tests)
 ✓ test/tokens.test.ts (3 tests)

# Frontend Production Build
cd frontend ; npm run build
✓ 2465 modules transformed.
dist/index.html                   1.48 kB
dist/assets/index-GUFY4Yj4.css   24.80 kB
dist/assets/index-Ca3Yo_oK.js   673.19 kB
✓ built in 1.99s
```

---

## 5. Pre-configured Demo Accounts

| Role | Name | Email | Passcode | Highlights |
| :--- | :--- | :--- | :--- | :--- |
| **Elder** | Grandmother Shanti | `shanti@demo.com` | `shanti123` | High-contrast UI, language switcher (EN/HI/MR), voice read-aloud, hero dose card. |
| **Caretaker (Admin)** | Son Rajesh | `rajesh@demo.com` | `rajesh123` | Peace of Mind banner, live escalation stepper, AI scan, demo reset controls. |
| **Caretaker (Nurse)** | Nurse Anita | `anita@demo.com` | `anita123` | Clinical oversight, appointments, adherence reports. |
| **Family Member** | Daughter Priya | `priya@demo.com` | `priya123` | Family portal, adherence score, "Suggest, Then Approve" workflow. |

---

## 6. How to Run Locally

```powershell
# Run frontend dev server (Vite on http://localhost:5173)
cd frontend
npm run dev

# Re-seed the demo circle locally
npm run seed

# Run live AWS integration tests
npx tsx scripts/e2e/test-phase1.ts
npx tsx scripts/e2e/test-phase2.ts
npx tsx scripts/e2e/test-phase3.ts
npx tsx scripts/e2e/test-phase4-7.ts
```

---

## 7. Known Architectural Trade-offs for Presentation

1. **SES Sandbox Mode:** Outbound emails only deliver to verified email addresses in AWS SES sandbox. The in-app **Notifications** tab provides an audit log of every email sent/attempted.
2. **Bedrock Cross-Region Inference:** Bedrock foundation models are accessed via cross-region inference (`us-east-1` from `ap-south-1`). Guarded with a 10s timeout and a manual entry fallback button.
3. **Web Speech API:** Voice synthesis uses native browser speech engines (`window.speechSynthesis`).
