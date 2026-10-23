# ResumeAI Pro — Advanced AI ATS Resume Scorer

Full-stack local web app: FastAPI backend, responsive vanilla-JavaScript frontend, SQLite persistence, private PDF storage, heuristic ATS scoring, and OpenAI-powered career tools.

## Requirements
Python 3.10+ and an optional OpenAI API key. ChatGPT Plus does **not** include API credits.

## Start

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Windows: copy .env.example .env
# Edit .env: set APP_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD and OPENAI_API_KEY
uvicorn app:app --reload
```

Open http://127.0.0.1:8000 . API docs: http://127.0.0.1:8000/docs .

## Features
- Register/login, salted PBKDF2 password hashing, signed 7-day bearer tokens
- Private, authenticated PDF upload/download/delete, 8 MB limit
- PDF text extraction (text PDFs only; OCR not included)
- ATS score with transparent weights: keyword overlap 65%, resume sections 20%, contact information 10%, length 5%
- Job-description comparison and missing/matched keyword feedback
- AI resume optimizer, career chatbot, cover letters, interview practice, role recommendations, resume critique
- PDF export of AI content
- Saved analyses, AI generations, activity audit history
- Admin statistics and recent activity (configure ADMIN_EMAIL and ADMIN_PASSWORD before first start)
- Responsive single-page dashboard

## Testing

```bash
pytest -q
```

## API
`/api/register`, `/api/login`, `/api/me`, `/api/resumes`, `/api/resumes/{id}/download`, `/api/analyze`, `/api/analyses`, `/api/activities`, `/api/ai/{kind}`, `/api/generations`, `/api/export/pdf`, `/api/admin/stats`, `/api/health`.

## Data model
`users`, `resumes`, `analyses`, `activities`, `generations` in `data/resumeai.sqlite3`. Original PDF bytes stored in `data/uploads/` under randomized filenames; metadata and extracted text stored in SQLite. Foreign keys enforce ownership relationships and cascading deletion. Delete a resume to remove its associated analyses; saved generations retain content but lose the resume reference.

## Security / deployment notes
This is a working local project and development baseline, **not a production-hardened SaaS**. Before public deployment: use HTTPS, strong APP_SECRET, reverse-proxy rate limiting, malware scanning for uploads, file quotas, backups, a production database such as PostgreSQL, managed private object storage, privacy/retention policies, monitoring, and stronger account recovery/session controls. Protect personal resumes and avoid exposing `.env` or `data/` in source control. The AI API receives extracted resume text and job descriptions. AI suggestions may be inaccurate and must be reviewed. Scores are heuristic estimates, not actual employer ATS results.

## Project structure
```
app.py              FastAPI routes, auth, scoring, persistence, AI integration
frontend/index.html Dashboard UI
frontend/style.css  Responsive styling
frontend/app.js     Frontend state, API integration, interactions
tests/test_app.py   End-to-end API tests
.env.example        Configuration template
requirements.txt    Dependencies
```
