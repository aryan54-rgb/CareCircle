# CareCircle: End-to-End Feature Walkthrough & Verification Guide

> A practical guide for navigating, testing, and verifying all CareCircle features across Elder, Caretaker, and Family roles.

---

## 1. Pre-Run Verification & Health Check

1. **Verify Backend Health:**
   - Log in as Caretaker: `rajesh@demo.com` / `rajesh123`.
   - Navigate to the **Settings** tab.
   - Inspect the **Deep Health Diagnostics** panel:
     - **DynamoDB:** `OK` (Read/Write operational)
     - **SES Account:** `OK` (Sending operational)
     - **Bedrock:** `OK` (Converse API operational)
2. **Reset to Clean Seed State:**
   - In the Caretaker navigation bar, click **"Reset Demo"** (or invoke `POST /demo/reset`).
   - This reinitializes `demo-circle` with a fresh 7-day schedule, past adherence records, and seeded members.
3. **Recommended Window Layout:**
   - **Window 1:** Elder View (`shanti@demo.com` / `shanti123`)
   - **Window 2:** Caretaker View (`rajesh@demo.com` / `rajesh123`)

---

## 2. Functional Walkthrough

### 2.1 Elder Mode (`shanti@demo.com`)
- **Large Accessibility Interface:** Uncluttered 3-tab layout (*Today, Appointments, Suggestions*), high-contrast elements, and 60px+ touch targets.
- **Multilingual Switcher:**
  - Click the **Language Toggle** in the top bar to switch between **English**, **Hindi (हिंदी)**, and **Marathi (मराठी)**.
  - All labels, reminders, and notifications instantly update.
- **Voice Read-Aloud:**
  - Click **"Read Aloud"** (*"सुनें"* / *"आवाज ऐका"*).
  - The browser Web Speech API vocalizes the dose name, time, instructions, and appointments in the selected language.
- **Take Dose:**
  - Tap **"I Took It"** (*"मैंने ले ली"* / *"मी औषध घेतले"*). The hero card updates immediately, logs an activity event, and decrements pill count.

---

### 2.2 Caretaker Dashboard (`rajesh@demo.com`)
- **Peace of Mind Banner:**
  - Located at the top of the dashboard.
  - Displays instant status (*"All doses on track today"*, *"Dose pending since..."*, or *"Dose MISSED"*) alongside the **Weekly Care Score** (e.g., 92%).
- **Live Escalation Stepper:**
  - View the next-due dose with a live visual stepper:
    `Elder Reminded ➔ Caretaker Alerted ➔ Family Alerted ➔ Missed`
  - Polled every 10 seconds with real-time countdown timers.
- **Demo Escalation Testing:**
  - Click **"Demo Escalation"** in the top bar (`POST /demo/trigger-missed`).
  - Forces an open dose into demo escalation mode (advancing every 60 seconds).
  - Observe the stepper progress from Reminded through Caretaker and Family alerts.
- **Notification Center:**
  - Switch to the **Notifications** tab.
  - Shows the complete chronological log of all notification attempts (recipient, subject, stage, status, error details).
  - Verifies the multi-tier escalation chain even when SES is in sandbox mode.

---

### 2.3 AI Prescription Scanner (Amazon Bedrock)
- In the Caretaker dashboard, open **Medications** ➔ **"Scan Prescription (AI)"**.
- Upload a photo of a prescription or doctor's note.
- Amazon Bedrock extracts medicine name, strength, and schedule times into draft inputs.
- **Confidence-Aware Review:**
  - Extracted fields are highlighted with amber review badges.
  - An explicit physical safety verification checkbox (*"I have physically verified the label against the bottle"*) is required before the Save button activates.
- If Bedrock is unavailable, clicking **"Enter Medication Details Manually"** provides direct access to manual entry.

---

### 2.4 Family Portal & Suggestion Flow (`priya@demo.com`)
- Log in as daughter Priya (`priya@demo.com` / `priya123`).
- Go to the **Suggestions** tab and propose a new supplement or appointment (e.g., *"Vitamin D3 1000 IU Daily"*).
- Switch to Grandmother Shanti's view: a suggestion card appears with simple **Approve** and **Decline** options.
- Approving automatically adds the medicine and generates its 7-day schedule without requiring complex inputs from the elder.

---

### 2.5 One-Tap Confirm (Email Links)
- Reminder emails contain secure, signed token links (`/p/confirm?t=...`).
- Visiting the link displays a clean verification landing page (GET safe against automated email crawlers).
- Tapping **"✓ Yes, I Took It"** triggers the mutation, advances dose status to `TAKEN`, and updates the Caretaker dashboard.

---

## 3. Account Credentials

| Role | Name | Email | Passcode |
| :--- | :--- | :--- | :--- |
| **Elder** | Grandmother Shanti | `shanti@demo.com` | `shanti123` |
| **Caretaker (Admin)** | Son Rajesh | `rajesh@demo.com` | `rajesh123` |
| **Caretaker (Nurse)** | Nurse Anita | `anita@demo.com` | `anita123` |
| **Family Member** | Daughter Priya | `priya@demo.com` | `priya123` |

---

## 4. Operational Notes

1. **SES Sandbox Mode:** Outbound emails only deliver to verified identities. For unverified test addresses, use the in-app **Notifications** tab to view the exact sent status and payload.
2. **Bedrock Model:** Configured for `us.amazon.nova-2-lite-v1:0` in `us-east-1` via cross-region inference from Mumbai (`ap-south-1`).
3. **Voice Engine:** Speech synthesis relies on the device browser's installed TTS voices.
