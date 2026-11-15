# CareCircle: 3-Minute Hackathon Demo Script & Playbook

> A concise, battle-tested presentation guide for pitching CareCircle to hackathon judges today.

---

## 1. Pre-Demo Checklist (5 Minutes Before Presenting)

- [ ] **1. Run Health Diagnostics:**
  - Log in as Caretaker (`rajesh@demo.com` / `rajesh123`).
  - Go to **Settings** tab.
  - Check the **Deep Health Diagnostics** panel:
    - DynamoDB: `OK` (Read/Write operational)
    - SES Account: `OK` (Sending enabled)
    - Bedrock: `OK` (Converse API operational)
- [ ] **2. Reset Demo State:**
  - In the Caretaker navigation bar, click **"Reset Demo"** (or use `POST /demo/reset`).
  - This resets `demo-circle` to a pristine 7-day schedule with seeded adherence.
- [ ] **3. Setup Browser Windows (Side-by-Side):**
  - **Left Window:** Elder View logged in as `shanti@demo.com` (passcode: `shanti123`).
  - **Right Window:** Caretaker Dashboard logged in as `rajesh@demo.com` (passcode: `rajesh123`).
- [ ] **4. Check Audio:**
  - Ensure speaker volume is unmuted on your demo machine for the Web Speech API voice synthesis read-aloud.

---

## 2. The 3-Minute Pitch Script

### Minute 0:00 – 0:45 | The Problem & Elder-First Design
- **Hook:** *"Most medication apps fail for a simple reason: they ring once, and nobody knows if the pill was actually swallowed. For an elderly grandparent, small screens, passwords, and tiny buttons are roadblocks."*
- **Show Left Window (Elder View):**
  - Point to the clean **Hero Dose Card** with high-contrast text and 60px+ touch targets.
  - **Language Toggle:** Switch from English to **Hindi (हिंदी)** or **Marathi (मराठी)**.
  - **Read Aloud:** Click the **"आवाज ऐका" / "सुनें" (Read Aloud)** button to let the judges hear the voice speaking the dose name, time, and instructions in the chosen language.
  - Point to the single prominent button: **"मी औषध घेतले" / "मैंने ले ली" (I Took It)**.

---

### Minute 0:45 – 1:45 | State Machine Escalation & Notification Center
- **Transition:** *"What happens when grandmother forgets? CareCircle doesn't just silence the alarm. It activates a multi-tiered safety net."*
- **Show Right Window (Caretaker View):**
  - Point out the **"Peace of Mind" banner** at the top: *"All doses on track today • Weekly Care Score: 92%"*.
  - Show the live **Escalation Timeline Stepper**:
    `Elder Reminded ➔ Caretaker Alerted ➔ Family Alerted ➔ Missed`
  - Click **"Demo Escalation"** in the top bar (`POST /demo/trigger-missed`).
  - Watch the countdown timer start: in demo mode, ticker stages advance every 60 seconds.
  - Switch to the **Notifications** tab:
    - Show the audit trail of sent alerts.
    - Highlight that even in an SES sandbox environment, CareCircle tracks and displays each stage of escalation independently.
  - **One-Tap Confirm:** Explain that reminder emails contain cryptographic signed tokens allowing single-tap verification without password login, protected against email scanner crawlers.

---

### Minute 1:45 – 2:30 | Bedrock AI Prescription Scan & Suggestion Flow
- **Show AI Scanner:**
  - Click **"Medications"** ➔ **"Scan Prescription (AI)"**.
  - Upload a sample prescription photo.
  - Amazon Bedrock extracts medicine name, strength, and schedule.
  - **Confidence-Aware Review:** Point out the amber highlighting on AI-extracted fields and the mandatory safety checkbox: *"I have physically verified the label against the bottle."*
- **Show Suggestion Flow:**
  - Explain how family members (like daughter Priya) can propose vitamins or doctor appointments without overwriting schedules unilaterally.
  - The elder or caretaker approves suggestions via simple one-tap cards.

---

### Minute 2:30 – 3:00 | Architecture & The Close
- **Architecture Highlight:**
  - Serverless on AWS: API Gateway HTTP API, Lambda (Hono framework), and DynamoDB Single Table.
  - EventBridge Scheduler runs a sparse index ticker (`GSI1`) that only evaluates pending doses—zero full-table scans.
- **The Close:**
  - *"CareCircle turns solitary pill reminders into a connected circle of care, ensuring no dose is forgotten."*

---

## 3. Backup Plan & Live Contingencies

| Scenario | What to Do | What to Say |
| :--- | :--- | :--- |
| **SES Sandbox recipient fails** | Open the in-app **Notifications** tab on Caretaker dashboard. | *"AWS SES in sandbox mode restricts external recipients, but our notification event bus captures and verifies the exact escalation chain in real-time."* |
| **Bedrock API latency or timeout** | Click **"Enter Medication Details Manually"** in the scan modal. | *"Our frontend provides graceful degradation: if AI services are unavailable, the manual entry workflow remains instant and 100% functional."* |
| **Demo state got messed up** | Click **"Reset Demo"** in the top header. | Instantly restores `demo-circle` to the initial state without database redeployment. |
| **No audio output** | Show the visual text translations in English, Hindi, and Marathi. | *"The platform pairs visual localized typography with Web Speech API audio for full accessibility."* |

---

## 4. Key Demo Credentials

- **Elder:** `shanti@demo.com` / `shanti123`
- **Caretaker (Admin):** `rajesh@demo.com` / `rajesh123`
- **Caretaker (Nurse):** `anita@demo.com` / `anita123`
- **Family:** `priya@demo.com` / `priya123`
