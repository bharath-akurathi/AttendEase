# AttendEase — TODO & Known Issues

This file tracks bugs, missing features, and planned improvements for the AttendEase project. Items are grouped by priority.

---

## 🔴 Critical Bugs

### 1. Page Reload Infinite Loop (Teacher / Admin)
**Status:** `open`
**File(s):** `frontend/src/context/AuthContext.jsx`, `frontend/index.html`

**Description:**
When a teacher or admin logs in and then reloads the page, the app sometimes gets stuck in an infinite loading loop. The `BrandLoader` spinner displays indefinitely (or until the 5-second timeout fires and forces `setLoading(false)`).

**Root Cause Analysis:**
- `AuthContext` runs two things on mount: checks `localStorage` for a student session, then calls `supabase.auth.getSession()` for Supabase sessions.
- Supabase also stores its session in `localStorage` under keys like `sb-<project-ref>-auth-token`.
- If a Vite-related key or a stale/corrupted Supabase key is present in `localStorage`, the session restoration can race or fail silently, leaving `loading` stuck at `true`.
- `index.html` already includes a cleanup script that removes `vite:` prefixed keys, but Supabase's own auth keys can also get into a bad state.
- The `onAuthStateChange` listener and the `getSession()` call can both fire, causing a double state-update that confuses the loading flag.

**Steps to Reproduce:**
1. Log in as teacher/admin.
2. Hard-reload the page (Ctrl+R / Cmd+R).
3. The spinner shows for 5 seconds, then (sometimes) the user is redirected to `/login` or the spinner never resolves.

**Suggested Fix:**
- Ensure `setLoading(false)` is always called in the `getSession` `.then()` callback regardless of success or failure.
- Add cleanup of stale `sb-*` localStorage keys in `index.html` alongside the existing `vite:` cleanup — but only when the user has explicitly logged out, not on every page load.
- Consider using a single source of truth: either rely entirely on Supabase session storage OR re-fetch the session from the server on every load. The current mix of `localStorage` + `getSession()` is fragile.
- Move the `setTimeout` fallback from 5000ms to a shorter value (e.g., 3000ms) to reduce perceived freeze time.

---

### 2. Admin Cannot Delete Users or Reset Passwords
**Status:** `open`
**File(s):** `backend/routes/admin.js`, `frontend/src/pages/AdminDashboard.jsx`

**Description:**
The Admin Dashboard only allows **role changes** for users. There is no UI or API endpoint to:
- Delete a user account (remove from `auth.users` and `profiles`)
- Reset / force-change another user's password

**Impact:** Admins cannot remove incorrect or duplicate student accounts. Password resets for teachers require direct Supabase dashboard access.

**Backend Status:** `admin.js` has a service-role Supabase client (`supabaseService`) already set up, which is capable of calling `supabaseService.auth.admin.deleteUser(userId)` and `supabaseService.auth.admin.updateUserById(userId, { password })`. The endpoints just have not been added yet.

**TODO:**
- [ ] Add `DELETE /api/admin/users/:id` endpoint that calls `supabaseService.auth.admin.deleteUser(id)`.
- [ ] Add `PATCH /api/admin/users/:id/password` endpoint that calls `supabaseService.auth.admin.updateUserById(id, { password: newPassword })`.
- [ ] Add delete and reset-password buttons to the user list in `AdminDashboard.jsx`.
- [ ] Add a confirmation modal before destructive actions.

---

## 🟠 High Priority

### 3. Hardcoded API URL in TimetableManager
**Status:** `open`
**File(s):** `frontend/src/components/TimetableManager.jsx` (line 10)

**Description:**
`const API_URL = 'http://localhost:5001/api';` is hardcoded. This breaks in production/Docker deployments where the API is served on a different host or port.

**Fix:** Replace with `const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001') + '/api';` — the same pattern used in all other dashboard files.

---

### 4. TimetableManager Uses Direct Supabase Session (Breaks Student Auth)
**Status:** `open`
**File(s):** `frontend/src/components/TimetableManager.jsx`

**Description:**
`TimetableManager` calls `supabase.auth.getSession()` directly to get auth headers. For student users (who use a custom JWT stored in `localStorage`, not a Supabase session), this always returns `null`, meaning student requests to the timetable API will fail with 401 errors.

**Fix:** Replace direct Supabase session calls with `useAuth()` from `AuthContext` and use `session?.access_token` — the same approach used in `TeacherDashboard` and `AdminDashboard`.

---

### 5. Student JWT Token Expiry Not Handled on Reload
**Status:** `open`
**File(s):** `backend/routes/auth.js`, `frontend/src/context/AuthContext.jsx`

**Description:**
The custom JWT issued to students has an expiry, but the frontend never checks if the stored token has expired. If a student leaves a tab open overnight, the token will be expired on the next API call, resulting in 401 errors with no user-facing explanation.

**Fix:**
- On `AuthContext` mount, decode the stored `attendease_student` token and check `exp` against `Date.now()`.
- If expired, clear `localStorage` and redirect to `/login`.
- Optionally, auto-refresh the token silently by re-calling the student-lookup endpoint.

---

### 6. CORS Is Fully Open
**Status:** `open`
**File(s):** `backend/server.js`

**Description:**
`app.use(cors())` with no origin restriction allows requests from any domain. This is a security risk in production.

**Fix:** Configure CORS with an allowlist: `cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173' })` and add `ALLOWED_ORIGIN` to all `.env.example` files.

---

### 7. No Input Validation / Sanitisation on Backend Routes
**Status:** `open`
**File(s):** All `backend/routes/*.js`

**Description:**
Route handlers rely entirely on database constraints to catch invalid data. There is no centralized validation layer. Malformed inputs generate confusing 500 errors instead of clear 400 responses.

**Fix:** Add a validation middleware (e.g., `zod` or `express-validator`) and validate request bodies before they reach the database. Especially important for `subjects`, `attendance`, and `admin` routes.

---

## 🟡 Medium Priority

### 8. Profile Load Race Condition on Login
**Status:** `open`
**File(s):** `frontend/src/context/AuthContext.jsx`

**Description:**
After `supabase.auth.getSession()` returns a user, the context fetches the user's profile. If this fetch is slow or fails, `profile` is `null` while `user` is set. `App.jsx` routes on `profile?.role`, causing the `BrandLoader` to spin indefinitely even though authentication succeeded.

**Fix:** Add explicit error handling for the profile fetch and display a proper error state instead of an infinite spinner.

---

### 9. CSV Export Missing Attendance Percentage
**Status:** `open`
**File(s):** `backend/routes/subjects.js` (`GET /:id/export`)

**Description:**
The exported CSV includes Roll, Name, Total Absences, and Absence Dates but not the total number of classes held or the attendance percentage — the most critical metric for faculty reports.

**Fix:** Query `COUNT(DISTINCT date)` from `absence_records` for the subject to compute total sessions, then include `total_classes` and `attendance_percentage` columns in the export.

---

### 10. No Pagination on User / Subject Lists
**Status:** `open`
**File(s):** `backend/routes/admin.js`, `backend/routes/subjects.js`

**Description:**
All list endpoints return the full dataset. For colleges with 1000+ students, this will be slow and memory-intensive.

**Fix:** Add `limit` and `offset` (or cursor-based) pagination query parameters to `GET /api/admin/users` and `GET /api/subjects`.

---

### 11. Bulk Student Create Errors Not Shown in UI
**Status:** `open`
**File(s):** `frontend/src/pages/AdminDashboard.jsx`

**Description:**
The bulk create results panel shows "Created" and "Skipped" counts but does not display the `errors` array returned by the API. If any roll numbers fail (e.g., wrong length), the admin has no visibility into which ones failed.

**Fix:** Render a scrollable error list below the summary cards when `bulkResult.errors.length > 0`.

---

### 12. Timetable Entries Not Linked to Subjects in UI
**Status:** `open`
**File(s):** `frontend/src/components/TimetableManager.jsx`

**Description:**
The timetable entry form only captures `class_name`, `day_of_week`, `start_time`, and `end_time`. The backend schema has a `subject_id` FK on `timetables`, but the frontend never lets the user select a subject — so all entries have a null `subject_id`.

**Fix:** Add a subject dropdown to the timetable entry form, populated from `GET /api/subjects`.

---

### 13. No Attendance Threshold Email Notifications
**Status:** `open` — *Feature request*

**Description:**
Students below the 75% attendance threshold receive no proactive notification. Teachers also have no bulk alert mechanism.

**Planned Implementation:**
- Add a Supabase Edge Function or a backend cron endpoint that queries at-risk students weekly.
- Send email alerts via Supabase's built-in email service or an external SMTP provider (e.g., Resend, SendGrid).

---

## 🟢 Low Priority / Quality of Life

### 14. No Tests
**Status:** `open`

**Description:**
There are zero unit, integration, or end-to-end tests in the codebase.

**TODO:**
- [ ] Add Jest + Supertest tests for all backend API routes (especially auth, attendance, admin).
- [ ] Add React Testing Library tests for `AuthContext` and the login flow.
- [ ] Consider Playwright for E2E testing of the full login → mark attendance workflow.

---

### 15. Landing Page Section Navigation Not Smooth
**Status:** `open`
**File(s):** `frontend/src/pages/LandingPage.jsx`

**Description:**
The `#features` and `#how-it-works` sections exist but anchor link scrolling is not reliable across all browsers. Nav items also have no active/highlighted state.

**Fix:** Replace anchor hrefs with smooth-scroll click handlers using `element.scrollIntoView({ behavior: 'smooth' })`.

---

### 16. Theme Preference Does Not Sync Across Browser Tabs
**Status:** `open`
**File(s):** `frontend/src/context/ThemeContext.jsx`

**Description:**
Changing the theme in one tab does not update other open tabs until they are manually reloaded.

**Fix:** Listen for `window` `storage` events and update the theme state when the `attendease-theme` key changes.

---

### 17. Roll Number Validation Is Only a Length Check
**Status:** `open`
**File(s):** `backend/routes/subjects.js`, `backend/routes/admin.js`

**Description:**
Roll numbers are only validated for being exactly 10 characters. There is no format check. Invalid formats are silently accepted.

**Fix:** Add a regex format check for the JNTUH roll number pattern (e.g., `/^[0-9]{2}[A-Z]{2}[0-9]{2}[A-Z][0-9]{3}$/`) and return a clear error on mismatch.

---

### 18. `SUPABASE_SERVICE_ROLE_KEY` Missing from `docker-compose.yml`
**Status:** `open`
**File(s):** `docker-compose.yml`

**Description:**
`docker-compose.yml` does not pass `SUPABASE_SERVICE_ROLE_KEY` to the backend container. Without it, admin operations that bypass RLS (bulk user creation, user deletion, password resets) fall back to the anon key and will fail silently or throw permission errors.

**Fix:** Add `- SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}` under the backend `environment` block in `docker-compose.yml`.

---

### 19. Subjects Are Hard-Deleted (No Soft Delete / Audit Trail)
**Status:** `open`
**File(s):** `backend/routes/subjects.js` (`DELETE /:id`)

**Description:**
Deleting a subject cascades to `subject_enrollments` and `absence_records`, permanently destroying all historical attendance data for that subject. There is no recovery path.

**Fix:** Implement soft-delete by setting `is_active = false` instead of physically deleting. Add an `include_inactive` query param for admin views. This preserves the audit trail while hiding archived subjects from normal views.

---

### 20. `authMode` State Can Be Inconsistent After Page Reload
**Status:** `open`
**File(s):** `frontend/src/context/AuthContext.jsx`

**Description:**
`authMode` is restored from localStorage on reload. If both an `attendease_student` key AND a Supabase `sb-*-auth-token` key exist simultaneously (e.g., on a shared device), the student session incorrectly takes priority over a teacher/admin session.

**Fix:** On logout, clear all localStorage keys matching `sb-*-auth-token` using a pattern-based scan rather than relying on the hardcoded project-ref key. Also clear `attendease_student` and `attendease-theme` on full sign-out if desired.

---

## 📝 Notes

- **SRS Alignment:** Items 2, 9, 13, 14 align with standard SRS requirements for an academic attendance management system (admin control, reporting, notifications, test coverage).
- **Security Priority:** Items 6, 7, 17, and 18 should be addressed before any public or production deployment.
- **Performance Priority:** Item 10 (pagination) and the existing indexes in `schema_v2.sql` cover the most critical scalability concerns.