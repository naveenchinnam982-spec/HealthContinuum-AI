# HealthContinuum AI 🏥🤖

> **Understand what changed. Know why. Close the gap.**
>
> A patient-centered healthcare continuity platform that brings medical records, document understanding, and doctor verification into one workflow.

**Health records shouldn't feel like a detective case.** HealthContinuum AI is designed to help patients and clinicians connect the dots across visits, prescriptions, and lab reports—while clearly flagging what the system cannot confidently read.

> [!IMPORTANT]
> **Demo / research project:** This repository describes a hackathon and research prototype, not a certified medical device or production-ready clinical system. Do not use it to make treatment decisions or upload real patient information unless the deployment has been properly secured, validated, and approved for that use. AI/OCR output must be verified by a qualified clinician.

---

## 🧭 The problem we're solving

A patient's health story is often scattered across hospital files, lab PDFs, phone photos, and handwritten prescriptions. A new doctor may see one page—but the patient is living the whole story.

HealthContinuum AI aims to make that story easier to follow:

- **One timeline:** bring visits, reports, and medication changes into a chronological view.
- **Document assistance:** preprocess uploaded documents and extract readable text from prescriptions and reports.
- **Honest uncertainty:** flag unclear handwriting instead of inventing a medicine name or dose.
- **Doctor review:** let patients package questions and uncertain items for a clinician to review.
- **Patient-friendly explanations:** provide English/Telugu assistance through the Dr. Anya companion, where configured.

### The tiny, relatable version

Imagine your medical records are puzzle pieces spread across five folders. HealthContinuum tries to put the pieces on one table. If a piece is blurry, it puts a **“please verify this”** sticky note on it—it should never draw a fake piece and pretend it was there. 🧩

---

## ✨ What the platform includes

| Area | What it is for |
| --- | --- |
| **Patient portal** (/patient) | Review a health timeline, upload records, and prepare questions for a doctor |
| **Doctor dashboard** (/doctor) | Review patient-submitted items, compare records, and document resolutions |
| **Document pipeline** | Improve image readability and extract text from medical documents |
| **Review access workflow** | Use a temporary access code/PIN to share a scoped review package |
| **Dr. Anya companion** | Patient assistance in English and Telugu, with voice features where supported |
| **Backend API** (/api) | Authentication, records, document workflows, and review endpoints |

Feature availability depends on configuration and the current implementation. A feature listed here should not be interpreted as proof that it has been clinically validated.

---

## 🔄 How it works

### 1. Patient-to-doctor review workflow

~~~mermaid
flowchart TD
    A["🧑 Patient opens the portal"] --> B["📄 Uploads a prescription or report"]
    B --> C["🧹 Image cleanup: deskew, denoise, improve contrast"]
    C --> D["🔎 OCR / document text extraction"]
    D --> E{"Is the extracted detail clear enough?"}
    E -- "Yes, still needs review" --> F["🗂️ Add it to the health timeline"]
    E -- "No / uncertain" --> G["🚩 Mark as uncertain — don't guess"]
    F --> H["💬 Patient selects questions for the doctor"]
    G --> H
    H --> I["🔐 Create a temporary review PIN/package"]
    I --> J["🩺 Doctor verifies the source and context"]
    J --> K["📝 Doctor records the resolution"]
    K --> L["📚 Keep a traceable review history"]
~~~

**In plain English:** upload → extract → flag uncertainty → ask the doctor → verify → record the answer.

*The doctor—not the OCR or AI—has the final say on clinical interpretation.*

### 2. High-level architecture

~~~mermaid
flowchart LR
    P["Patient web app"] --> API["FastAPI backend"]
    D["Doctor dashboard<br/>React + Vite"] --> API
    API --> AUTH["Authentication & access checks"]
    API --> DOC["Document / OCR services"]
    API --> DB[("SQLAlchemy + SQLite")]
    DOC --> OCR["Image preprocessing + OCR providers"]
    OCR --> SAFE["Uncertainty & verification flags"]
    SAFE --> DB
    API --> AUDIT["Review / audit events"]
    DB --> TIMELINE["Patient timeline & review queue"]
~~~

| Layer | Main technologies in the repository |
| --- | --- |
| Doctor dashboard | React 18, TypeScript, Vite, Tailwind CSS, Lucide icons |
| Backend/API | Python, FastAPI, SQLAlchemy async, Pydantic v2 |
| Document processing | OpenCV preprocessing; Tesseract and/or configured vision extraction |
| Data store | SQLite in the documented local setup |
| Patient experience | HTML, CSS, JavaScript, Web Speech API where supported |

---

## 🧠 Document processing, without the jargon

The document pipeline is intended to improve the image before text extraction:

1. **Grayscale** — simplify the image to brightness information.
2. **Thresholding** — help separate writing from the page background.
3. **Deskewing** — straighten a photo taken at an angle.
4. **Denoising / CLAHE** — reduce visual noise and improve local contrast.
5. **OCR and normalization** — extract text and normalize supported shorthand.
6. **Uncertainty handling** — flag ambiguous output for human confirmation.

### A very important rule

A blurry prescription is not a guessing game. If a medicine name, dose, or frequency is unclear, the result must be treated as **uncertain** and checked with the prescribing clinician or pharmacist. Do not take, stop, or change medication based only on OCR or AI output.

---

## 🧑‍⚕️ Main user journeys

### Patient

1. Open the patient portal.
2. Add available prescriptions, consultation notes, or lab reports.
3. Review the timeline and extracted details.
4. Select unclear items or questions.
5. Generate a temporary doctor-review package/PIN, if enabled.
6. Wait for a clinician to verify and resolve the questions.

### Doctor

1. Open the doctor dashboard and authenticate.
2. Enter the patient's temporary PIN when required.
3. Review the submitted question, original source, and related context.
4. Compare previous and current information.
5. Record a clinical resolution or note.
6. Confirm the review has been saved and is visible in the intended history.

**Friendly reminder:** the PIN is a short-lived access mechanism, not a substitute for secure authentication, patient consent, authorization checks, or audit controls.

---

## 🚀 Run locally

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- Git
- Tesseract OCR, if required by your local OCR configuration

### Option A — Windows one-click launcher

From the repository root, run:

~~~bat
start_all.bat
~~~

According to the project setup, this launcher seeds demo data, builds the doctor dashboard, and starts the FastAPI backend on port 8000. Review the script before running it if you are unsure what it changes.

### Option B — Start the backend and dashboard separately

**1. Backend**

From the repository root:

~~~bash
cd maruthi/Health/backend
python -m venv .venv
~~~

Activate the virtual environment, then install and run:

~~~bash
pip install -r requirements.txt
python seed.py
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
~~~

**2. Doctor dashboard**

Open a second terminal at the repository root:

~~~bash
cd doctorsdashboard-main
npm install
npm run dev
~~~

To create a production frontend bundle instead:

~~~bash
npm run build
~~~

The documented unified setup serves the built dashboard through FastAPI. Follow the actual app configuration if the frontend/API paths differ in your environment.

### Local URLs

| Service | URL |
| --- | --- |
| Unified portal | http://localhost:8000/ |
| Patient application | http://localhost:8000/patient |
| Doctor dashboard | http://localhost:8000/doctor |
| API documentation | http://localhost:8000/api/docs |
| Health check | http://localhost:8000/api/health |
| Vite development server (when running) | http://localhost:5173 |

These are **local development URLs**, not public deployment addresses.

---

## 🗂️ Repository map

~~~text
.
├── start_all.bat
├── README.md
├── doctorsdashboard-main/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   └── types/
│   └── dist/                    # generated by the production build
└── maruthi/
    ├── healthcontinuum.html     # unified landing page
    └── Health/
        ├── index.html           # patient app
        ├── app.js
        ├── styles.css
        ├── api.js
        └── backend/
            ├── requirements.txt
            ├── seed.py
            └── app/
                ├── main.py
                ├── core/
                ├── database/
                ├── models/
                ├── schemas/
                ├── services/
                └── api/routes/
~~~

Generated files, local databases, uploads, and environment files may vary by branch and setup. Check .gitignore before committing local data.

---

## 🔐 Demo accounts and data

The local seed script may create demo users and synthetic records. **Use only the credentials configured by the current seed script or local environment.** Do not rely on credentials copied into old documentation, and never publish real passwords, API keys, tokens, or real patient data in this README.

For a public demo:
- Use synthetic patient records only.
- Change any default credentials before exposing the app.
- Keep secrets in environment variables or the hosting provider's secret settings.
- Ensure patient ownership, authentication, authorization, temporary-PIN expiry/scope, and audit logging are enforced by the backend—not just by hiding frontend screens.

---

## 🛡️ Safety, privacy, and responsible use

- **No invented prescriptions:** ambiguous extracted instructions should be marked uncertain/unreadable, not silently filled in.
- **Human clinical authority:** AI output is assistive; qualified healthcare professionals make clinical decisions.
- **Source-aware review:** reviewers should be able to inspect the original document and relevant context before resolving a question.
- **Access control:** verify identity, patient ownership, permissions, PIN expiry, and allowed actions on the server.
- **Privacy by design:** avoid putting real patient information, uploaded documents, local databases, or secrets in public commits.
- **Auditability:** log important access and resolution events, and protect those logs from unauthorized modification.

These are design goals and review requirements—not a claim that every control has already been independently audited or clinically validated.

---

## 🧰 Troubleshooting checklist

| Symptom | First things to check |
| --- | --- |
| Doctor page loads but data does not | Is the API running? Does the frontend point to the correct API base URL? |
| Login fails | Check the backend logs, seed configuration, environment variables, and auth endpoint response |
| OCR result is empty or incorrect | Check file type/size, image quality, OCR dependencies, provider configuration, and uncertainty output |
| Works locally but not after deployment | Confirm the deployed frontend build, API hosting, CORS, environment variables, and route rewrites |
| Refreshing a nested page returns 404 | Check SPA fallback/redirect configuration for the frontend host |
| Latest UI changes are not visible | Confirm the latest commit, build status, publish directory, and deployed commit SHA |

**Deployment note:** the frontend and FastAPI backend are separate runtime concerns. Publishing the React/Vite files does not automatically host the Python API or make the database persistent. Verify both sides and their configuration before treating a deployment as working.

---

## 🛣️ Suggested next improvements

- Automated tests for authentication, patient ownership, PIN expiry, and review authorization.
- End-to-end tests for upload → extraction → uncertain item → doctor resolution.
- OCR evaluation on a consented, de-identified dataset, with measured accuracy and uncertainty calibration.
- Clear loading, empty, failure, and retry states in patient and doctor workflows.
- Deployment checks for API reachability, persistent storage, CORS, and secret management.
- Accessibility checks, mobile layouts, and English/Telugu content review.

---

## 📄 Project status and license

This project is intended for hackathon demonstration and clinical continuity research. No license terms are specified here; add a LICENSE file if you intend to grant others explicit reuse rights.

---

<p align="center">
  <strong>Less record-hunting. Fewer question marks. Better conversations with clinicians. 💙</strong>
</p>
