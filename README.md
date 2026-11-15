# CareCircle: Elderly Care & Medication Management Platform

> A smart, interconnected healthcare platform designed for elderly individuals, caretakers, and family members — built for AWS and deployed in **ap-south-1 (Mumbai)**.

---

## 1. Problem & Innovation

Basic medication reminder apps fail because:
1. A notification rings once; nobody knows if the pill was actually taken.
2. Elders struggle with tiny smartphone interfaces, complex logins, and passwords.
3. Caretakers often silently override schedules without the elder's awareness.
4. Typing complex prescriptions is tedious and error-prone.
5. Family members get noisy alerts instead of actionable insights.

### The CareCircle Answer
- **Elder at the Centre:** A dedicated **Elder Mode** with large 24px+ typography, high-contrast palette, 60px+ touch targets, browser **speech synthesis (Read Aloud)**, and a prominent **Hero Card** for the next dose.
- **Dose-Event State Machine with Escalation:** `SCHEDULED` ➔ `REMINDED` (elder) ➔ `ESCALATED_1` (caretakers) ➔ `ESCALATED_2` (family + caretakers) ➔ `MISSED`.
- **One-Tap Confirm via Email:** Expiring signed token links in reminder emails let elders confirm taking medication in a single tap without needing to log in (GET landing page protects against email prefetch crawlers; mutation only occurs on POST).
- **Suggest, Then Approve Workflow:** Family members can propose vitamins, schedule changes, or appointments, but the elder (or primary caretaker) explicitly approves them via simple Yes/No cards.
- **Multimodal AI Prescription Scanner:** Uses **Amazon Bedrock Converse API** to extract schedule details from doctor notes and prescription photos directly into an editable review form.
- **Deterministic Adherence & Low Pill Alerts:** Calculates compliance percentages and warns caretakers before medication runs out.

---

## 2. Serverless AWS Architecture

```
                 React SPA (Vite + Tailwind CSS + Lucide + Recharts)
                                      |
                                      v HTTPS
                             API Gateway (HTTP API)
                                      |
             +------------------------+------------------------+
             |                                                 |
             v                                                 v
   Lambda "api" (Hono router)                       Lambda "public" (One-Tap)
             |                                                 |
             +------------------------+------------------------+
                                      |
     +--------------------------------+--------------------------------+
     |                                |                                |
     v                                v                                v
DynamoDB (CareTable)           Amazon SES v2                  Amazon Bedrock
Single Table Design           (Color-coded Emails)         (Converse API Extraction)
     ^
     |
EventBridge Scheduler
     |-- rate(1 minute) ---> Lambda "ticker" (evaluates sparse GSI1, advances escalation)
     |-- cron weekly    ---> Lambda "digest" (family adherence summary)
     |-- cron daily     ---> Lambda "ticker" with {task: "extend-horizon"}
```

### AWS Cloud Deployment Info
- **AWS Region:** `ap-south-1` (Mumbai)
- **Live HTTP API Gateway:** `https://odu8ihixga.execute-api.ap-south-1.amazonaws.com`
- **DynamoDB Single Table:** `carecircle-dev-table` (Pay-per-request, with sparse index `GSI1` and TTL)
- **Bedrock Region:** `us-east-1` (`us.amazon.nova-2-lite-v1:0` / Claude)

---

## 3. Data Model (DynamoDB Single Table `CareTable`)

| Entity | PK | SK | Key Fields & Indexing |
| :--- | :--- | :--- | :--- |
| **Circle** | `C#{circleId}` | `META` | `name`, `elderName`, `timezone`, `settings` |
| **Member** | `C#{circleId}` | `M#{memberId}` | `name`, `email`, `role` (`ELDER`/`CARETAKER`/`FAMILY`), `passcodeHash` |
| **Login Lookup** | `U#{email}` | `LOGIN` | `circleId`, `memberId` (O(1) email login resolution) |
| **Invite** | `INV#{code}` | `META` | `circleId`, `role`, `expiresAt`, `usedAt`, `ttl` |
| **Medication** | `C#{circleId}` | `MED#{medId}` | `name`, `strength`, `form`, `times[]`, `pillCount`, `refillThreshold` |
| **Dose Event** | `C#{circleId}` | `D#{dueAt}#{medId}` | `medName`, `status`, `nextActionAt`, `GSI1PK="OPEN"`, `GSI1SK=nextActionAt` |
| **Appointment** | `C#{circleId}` | `A#{startsAt}#{apptId}`| `doctor`, `place`, `notes`, `stage`, `GSI1PK="OPEN"`, `GSI1SK=nextActionAt` |
| **Suggestion** | `C#{circleId}` | `S#{createdAt}#{id}` | `title`, `type`, `payload`, `status` (`PENDING`/`APPROVED`/`DECLINED`) |
| **Activity** | `C#{circleId}` | `L#{createdAt}#{id}` | `actorName`, `action`, `summary` |
| **Login Lockout** | `U#{email}` | `ATTEMPTS` | `count`, `ttl` (15-minute lockout after 5 failures) |

*Note: On terminal status transition (`TAKEN`, `SKIPPED`, `MISSED`), `GSI1PK` and `GSI1SK` are removed so the sparse index only holds open work.*

---

## 4. Demo Accounts & Walkthrough

Run the demo seeder to populate the sample care circle:
```bash
npm run seed
```

### Pre-configured Demo Accounts
| Role | Name | Email | Passcode | Interface Experience |
| :--- | :--- | :--- | :--- | :--- |
| **Elder** | Grandmother Shanti | `shanti@demo.com` | `shanti123` | **Simpler 3-Tab UI:** 24px+ typography, speech read-aloud, hero card. |
| **Caretaker (Owner)** | Son Rajesh | `rajesh@demo.com` | `rajesh123` | **Full Management:** Schedules, prescription scanner, invite codes, settings. |
| **Caretaker (Nurse)** | Nurse Anita | `anita@demo.com` | `anita123` | **Clinical View:** Mark on behalf, appointments, adherence tracking. |
| **Family** | Daughter Priya | `priya@demo.com` | `priya123` | **Family Portal:** View adherence, submit suggestions for elder approval. |

---

## 5. Hackathon Demo Script (5-Minute Winning Pitch)

1. **Elder Accessibility First:** Log in as **Grandmother Shanti** (`shanti@demo.com`). Show the uncluttered interface, tap **"Read Aloud"** to hear voice synthesis, and view the large **"I TOOK IT"** button.
2. **Family Collaboration ("Suggest, Then Approve"):** Log in as **Daughter Priya** (`priya@demo.com`) on another tab. Propose a new medication (*"Vitamin D3 1000 IU Daily"*). Switch back to Grandmother Shanti — an alert card appears: *"Daughter Priya suggests: Vitamin D3. Approve?"*. Tap **Approve** — the medication is instantly added and 7 days of scheduled doses are materialised!
3. **AI Prescription Scan:** Log in as **Son Rajesh** (`rajesh@demo.com`). Click **"Scan Prescription (AI)"**, upload a photo. Show Amazon Bedrock extracting the medication name, strength, and times into an editable draft form. Confirm and save.
4. **Live Demo Escalation:** In Settings, click **"Demo Escalation"** (`POST /demo/trigger-missed`). Watch the ticker evaluate the open dose in real time under demo timing (`pre=0, e1=1m, e2=2m, missed=3m`):
   - Minute 0: Elder reminder email fires.
   - Minute 1: Caretaker escalation alert fires.
   - Minute 2: Family escalation alert fires.
   - Minute 3: Final missed dose recorded.
5. **One-Tap Confirm:** Open the reminder email link in a browser (or test `/p/confirm?t=...`). Tap the big **"✓ Yes, I Took It"** button without logging in. The dose flips to `TAKEN` across all dashboards, and pill inventory decrements.
6. **Analytics & Activity Log:** View the Recharts weekly compliance graph and verify the activity feed showing full transparency of who took what and when.

---

## 6. Local Development & Verification

### Run Automated Tests
```bash
# Run Vitest pure unit tests (17 tests covering state machines, permissions, and math)
npm test

# Run Live Cloud Verification on AWS ap-south-1
npx tsx scripts/test-phase1.ts
npx tsx scripts/test-phase2.ts
npx tsx scripts/test-phase3.ts
npx tsx scripts/test-phase4-7.ts
```

### Launch Frontend Locally
```bash
npm run dev
# Opens Vite React SPA on http://localhost:5173
```

### Deploy to AWS
```bash
sam build
sam deploy
```

---

## 7. Compliance & Disclaimer
> **Disclaimer:** CareCircle helps organise routines and collaborate with loved ones. It is not medical advice. Always follow your doctor's instructions.
