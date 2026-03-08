# AttendEase 🎓

> **The modern, full-stack Attendance Management System built for JNTUH College of Engineering Hyderabad.**

AttendEase is a purpose-built absence-tracking platform that brings together Admins, Teachers, and Students under one roof. Teachers mark absences in seconds, students instantly see where they stand, and admins manage the entire academic structure — all in a single, polished interface.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture Overview](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Authentication Flow](#-authentication-flow)
- [Setup & Installation](#-setup--installation)
- [Deployment (Docker)](#-deployment-docker)
- [Known Issues](#-known-issues)

---

## ✨ Features

### 👤 Role-Based Access Control (RBAC)
Three distinct roles — **Admin**, **Teacher**, and **Student** — each with a tailored dashboard and enforced permissions at both the API and database (RLS) level.

### 🛡️ Admin Dashboard
- View system-wide statistics: total users, students, teachers, subjects
- Manage all user accounts (view, role assignment)
- Create and manage **Regulations** (e.g., R18, R22) and **Courses** (B.Tech, M.Tech, IDP)
- Bulk-create student accounts using roll number ranges (e.g., `21A91A05` prefix, range 01–60)
- Manage subjects across all teachers

### 🧑‍🏫 Teacher Dashboard
- Create and manage **Subjects** (linked to regulation → course → year → semester)
- Add students individually by roll number or **bulk-enroll** using roll number ranges
- Mark daily attendance: select a subject, pick a date, toggle absent students, and save — idempotent (re-saves replace prior records for that date)
- View previously recorded absences per subject/date
- Export attendance as **CSV** per subject
- Manage a weekly **Timetable** (in-app entries + photo/PDF uploads)
- Change account password

### 🎓 Student Dashboard
- **Password-less login** via JNTUH roll number (read-only JWT, no Supabase account required)
- View attendance percentage per subject with visual progress rings
- Filter by Year / Semester
- Real-time risk indicator: **Good Standing** (≥75%), **Warning** (65–74%), **At Risk** (<65%)
- View individual absence dates per subject

### 🔐 Secure Authentication
- Teachers/Admins sign in via **Supabase Auth** (email restricted to `@jntuhceh.ac.in`)
- Students use a **password-less roll number lookup** returning a signed read-only JWT
- A Postgres trigger (`handle_new_user`) auto-creates profiles on signup
- A domain-enforcement trigger rejects non-`@jntuhceh.ac.in` emails at the DB level

### 🎨 UI/UX
- Dark / Light theme toggle (persisted via `localStorage`)
- Smooth page transitions powered by **Framer Motion**
- Fully responsive design via **TailwindCSS**
- `BrandLoader` splash screen with a 5-second timeout fallback to prevent infinite loading

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  React + Vite  ·  TailwindCSS  ·  Framer Motion │
│                                                  │
│  AuthContext  ←→  Supabase JS client (auth only) │
│  API calls    ←→  Express Backend (REST)         │
└──────────────────────┬──────────────────────────┘
                       │ HTTP / JWT Bearer
┌──────────────────────▼──────────────────────────┐
│               Express Backend                    │
│  Node.js  ·  Express  ·  jsonwebtoken            │
│                                                  │
│  /api/auth       — student lookup, pwd change    │
│  /api/attendance — mark & query absences         │
│  /api/subjects   — CRUD subjects & enrollments   │
│  /api/academic   — regulations & courses         │
│  /api/admin      — user management, bulk create  │
│  /api/timetables — schedule entries & uploads    │
└──────────────────────┬──────────────────────────┘
                       │ Supabase JS (service role)
┌──────────────────────▼──────────────────────────┐
│              Supabase (PostgreSQL)               │
│  Row Level Security  ·  Auth Triggers            │
│  Storage (timetable-uploads bucket)              │
└─────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TailwindCSS, Framer Motion, Lucide React, Sonner (toasts) |
| **Backend** | Node.js, Express.js, jsonwebtoken, multer |
| **Database** | Supabase (PostgreSQL + Row Level Security) |
| **Auth** | Supabase Auth (email/password for staff) + custom JWT (students) |
| **Storage** | Supabase Storage (`timetable-uploads` bucket) |
| **Deployment** | Docker + Docker Compose |

---

## 📁 Project Structure

```
AttendEase/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  # Root router with role-based dashboard routing
│   │   ├── main.jsx                 # Entry point, wraps AuthProvider + ThemeProvider
│   │   ├── index.css                # TailwindCSS base + custom CSS variables
│   │   ├── context/
│   │   │   ├── AuthContext.jsx      # Auth state, login/logout/student-lookup logic
│   │   │   ├── AcademicContext.jsx  # Regulations & courses data provider
│   │   │   └── ThemeContext.jsx     # Dark/light theme toggle
│   │   ├── components/
│   │   │   ├── BrandLoader.jsx      # Full-screen branded loading spinner
│   │   │   ├── ChangePassword.jsx   # Password change modal (teachers/admins)
│   │   │   ├── ThemeToggle.jsx      # Dark/light toggle button
│   │   │   └── TimetableManager.jsx # Weekly schedule + file upload manager
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx      # Marketing landing page
│   │   │   ├── Login.jsx            # Dual-mode login (student roll / teacher email)
│   │   │   ├── AdminDashboard.jsx   # Admin panel (users, subjects, bulk create)
│   │   │   ├── TeacherDashboard.jsx # Teacher panel (subjects, attendance, timetable)
│   │   │   └── StudentDashboard.jsx # Student panel (attendance stats & history)
│   │   └── lib/
│   │       └── supabase.js          # Supabase client initialisation
│   ├── index.html                   # Entry HTML (includes vite: localStorage cleanup)
│   ├── Dockerfile
│   └── .env.example
├── backend/
│   ├── server.js                    # Express app setup, route mounting
│   ├── middleware/
│   │   └── authMiddleware.js        # JWT verification (student + Supabase tokens)
│   ├── routes/
│   │   ├── auth.js                  # Student lookup, password change
│   │   ├── attendance.js            # Mark & query absence records
│   │   ├── subjects.js              # Subject CRUD, student enrolment, CSV export
│   │   ├── academic.js              # Regulations & courses CRUD
│   │   ├── admin.js                 # User management, stats, bulk student creation
│   │   └── timetables.js            # Timetable entries + file uploads
│   ├── Dockerfile
│   └── .env.example
├── supabase/
│   ├── schema.sql                   # V1 schema (legacy reference)
│   └── schema_v2.sql                # ✅ Current schema — use this
├── docker-compose.yml
└── README.md
```

---

## 🗄️ Database Schema

The current schema is defined in `supabase/schema_v2.sql`. Below is a summary of the key tables:

| Table | Description |
|---|---|
| `profiles` | Extends `auth.users`. Stores role, full_name, roll_number, regulation_id, course_id, year, semester, department |
| `regulations` | Academic regulations (R18, R22, etc.) |
| `courses` | Courses under a regulation (B.Tech CSE, M.Tech, IDP, etc.) |
| `subjects` | A specific subject taught by a teacher for a regulation/course/year/semester |
| `subject_enrollments` | Many-to-many: student ↔ subject |
| `absence_records` | One record per absent student per subject per date |
| `timetables` | In-app weekly schedule entries (teacher → subject → day/time) |
| `timetable_uploads` | Photo/PDF uploads stored in Supabase Storage |

### Key Database Functions (RPCs)
- `handle_new_user()` — Trigger: auto-creates a profile row on `auth.users` insert
- `resolve_roll_number(roll_no)` — Maps a roll number to a profile UUID
- `get_system_stats()` — Returns aggregate counts for the admin dashboard
- `get_student_attendance(...)` — Returns per-subject attendance summary for a student

---

## 🔌 API Reference

All endpoints require a `Bearer <token>` header unless noted.

### Auth — `/api/auth`
| Method | Path | Description |
|---|---|---|
| `POST` | `/student-lookup` | Password-less student login by roll number → returns read-only JWT |
| `POST` | `/change-password` | Change password (teachers/admins only) |

### Attendance — `/api/attendance`
| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Query absence records (filter by subjectId, date, studentId) |
| `GET` | `/history` | Attendance summary for the logged-in student (via `get_student_attendance` RPC) |
| `POST` | `/` | Submit/replace absences for a subject+date (idempotent) |

### Subjects — `/api/subjects`
| Method | Path | Description |
|---|---|---|
| `GET` | `/` | List subjects (teacher: own; student: enrolled; admin: all) |
| `POST` | `/` | Create a subject |
| `PATCH` | `/:id` | Update a subject |
| `DELETE` | `/:id` | Delete a subject |
| `GET` | `/:id/students` | List enrolled students |
| `POST` | `/:id/students` | Enrol a student by roll number |
| `DELETE` | `/:id/students/:stuId` | Remove a student |
| `POST` | `/:id/students/bulk` | Bulk enrol students (array or prefix+range) |
| `GET` | `/:id/export` | Export attendance as CSV |

### Academic — `/api/academic`
| Method | Path | Description |
|---|---|---|
| `GET` | `/regulations` | List all regulations |
| `POST` | `/regulations` | Create a regulation (admin only) |
| `GET` | `/courses` | List all courses |
| `POST` | `/courses` | Create a course (admin only) |

### Admin — `/api/admin`
| Method | Path | Description |
|---|---|---|
| `GET` | `/stats` | System-wide statistics |
| `GET` | `/users` | List all users |
| `PATCH` | `/users/:id/role` | Change a user's role |
| `POST` | `/students/bulk` | Bulk-create student accounts (range mode, max 200) |

### Timetables — `/api/timetables`
| Method | Path | Description |
|---|---|---|
| `GET` | `/` | List timetable entries |
| `POST` | `/` | Create a timetable entry |
| `PUT` | `/:id` | Update a timetable entry |
| `DELETE` | `/:id` | Delete a timetable entry |
| `GET` | `/uploads` | List timetable file uploads |
| `POST` | `/uploads` | Upload a timetable file (JPEG/PNG/WebP/PDF, max 10 MB) |
| `GET` | `/uploads/:id` | Get upload metadata + signed URL |
| `PATCH` | `/uploads/:id` | Update upload metadata |
| `DELETE` | `/uploads/:id` | Delete upload (file + record) |

---

## 🔐 Authentication Flow

### Teachers / Admins
1. Sign in with `@jntuhceh.ac.in` email via Supabase Auth
2. A `supabase.auth.onAuthStateChange` listener in `AuthContext` keeps the session in sync
3. On reload, `supabase.auth.getSession()` restores the session automatically
4. The Bearer token sent to the backend is the **Supabase JWT** verified by `jsonwebtoken` against `SUPABASE_JWT_SECRET`

### Students
1. Enter JNTUH roll number on the login page (no password)
2. Backend `/api/auth/student-lookup` looks up the roll number in `profiles` and returns a **custom read-only JWT** (issuer: `attendease`, `read_only: true`)
3. The JWT is stored in `localStorage` as `attendease_student`
4. On reload, `AuthContext` reads `attendease_student` from localStorage and restores state
5. The backend `authMiddleware` recognises the custom JWT by checking `iss === 'attendease'` and `read_only === true`

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js ≥ 18
- A [Supabase](https://supabase.com/) project

### 1. Database Setup

Run **`supabase/schema_v2.sql`** in your Supabase SQL editor to create all tables, RLS policies, triggers, and indexes. Do **not** run `schema.sql` — that is the legacy V1 schema kept for reference only.

### 2. Environment Variables

> ⚠️ **Never commit `.env` files to Git.**

**`frontend/.env`** (copy from `frontend/.env.example`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
VITE_API_URL=http://localhost:5001
```

**`backend/.env`** (copy from `backend/.env.example`):
```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
SUPABASE_JWT_SECRET=your-jwt-secret
```

> The `SUPABASE_JWT_SECRET` can be found in your Supabase project → **Settings → API → JWT Secret**.
> The `SUPABASE_SERVICE_ROLE_KEY` is required for admin operations that bypass RLS (bulk user creation, role changes).

### 3. Local Development

**Start the backend:**
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5000
```

**Start the frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

> The frontend proxies API calls to `http://localhost:5001` by default (as set in `VITE_API_URL`). The docker-compose maps backend port 5000 → host 5001.

### 4. Supabase Storage

Create a storage bucket named **`timetable-uploads`** in your Supabase project. Set appropriate RLS policies (authenticated users can upload; teachers/admins can delete their own uploads).

---

## 📦 Deployment (Docker)

The repository includes a `docker-compose.yml` that orchestrates both the frontend (served via Nginx on port 80) and backend (on port 5001).

**1. Create a root `.env` file:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
SUPABASE_JWT_SECRET=your-jwt-secret
```

**2. Build and start:**
```bash
docker-compose up --build -d
```

The frontend will be available at `http://localhost:80` and the backend API at `http://localhost:5001`.

---

## 🐛 Known Issues

See [`todos.md`](./todos.md) for a full list of known planned improvements.

*Currently, the primary system runs stably with no known active show-stopping bugs.*

---

## 📄 License

This project was built for academic use at JNTUH College of Engineering Hyderabad.