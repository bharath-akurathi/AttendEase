# AttendEase 🎓

AttendEase is a modern, full-stack Attendance Management System built with React (Vite), Node.js (Express), and Supabase. It features distinct role-based dashboards to manage attendance seamlessly for Admins, Teachers, and Students.

## ✨ Features

- **Role-Based Access Control (RBAC):** Distinct views for Admins, Teachers, and Students.
- **Admin Dashboard:** Manage users, assign subjects to teachers, and define academic structures (regulations, courses, semesters).
- **Teacher Dashboard:** Take class attendance with a smooth interface and track absentee students dynamically.
- **Student Dashboard:** View real-time attendance percentages, visually track absences by semester, and manage streaks.
- **Secure Authentication:** JWT-based authentication via Supabase Auth with custom Postgres Triggers locking down domain registrations to `@jntuhceh.ac.in`.

## 🛠️ Tech Stack

- **Frontend:** React, Vite, TailwindCSS, Framer Motion, Lucide React
- **Backend:** Node.js, Express.js
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, Auth Triggers)

## 🚀 Quick Start & Setup

To run this application, you must provision a [Supabase](https://supabase.com/) project and retrieve your environment credentials.

### 1. Database Setup
Ensure your Supabase project is active and use the SQL definitions found in `supabase/schema_v2.sql` to generate the correct tables, triggers, and Row Level Security policies. Or, apply migrations locally if using the Supabase CLI.

### 2. Environment Variables
**Never commit your `.env` files to Git.**

1. Copy `frontend/.env.example` to `frontend/.env` and fill it in:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJh...
   ```
2. Copy `backend/.env.example` to `backend/.env` and fill it in:
   ```env
   PORT=5000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJh...
   SUPABASE_JWT_SECRET=your-jwt-secret
   ```

### 3. Local Development

**1. Start the Backend API**
```bash
cd backend
npm install
npm run dev
```

**2. Start the Frontend App**
```bash
cd frontend
npm install
npm run dev
```
The app will be available at `http://localhost:5173`. Make sure the Express backend runs on `http://localhost:5000`.

## 📦 Deployment (Docker)
You can deploy the full stack effortlessly utilizing the provided docker configuration. Create a root `.env` injecting all required credentials, then:
```bash
docker-compose up --build -d
```
