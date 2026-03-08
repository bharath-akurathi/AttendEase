# AttendEase Maintenance Roadmap

✅ **Sprint 1: Architecture & Critical Bugs (COMPLETED)**
- [x] Fixed: Page Reload Infinite Loops (stale tokens properly flushed via custom AuthContext mapping)
- [x] Fixed: Attendance Database Architecture (0 absences/holidays now handled correctly via explicit `class_sessions` relations and modified Supabase RPCs).
- [x] Feature: Admin capabilities to delete errant users and reset passwords via Supabase Service Key proxying.
- [x] Fixed: Admin Dashboard academic creation endpoints mapped correctly to `/api/academic`.

✅ **Sprint 2: Robustness & Data Integrity (COMPLETED)**
- [x] API Protections: Locked down CORS strictly to `ALLOWED_ORIGIN`.
- [x] Input Validation: Integrated strict `zod` schemas enforcing UUID formats, regex bounds, and typing on all high traffic APIs natively before hitting Supabase.
- [x] Course Expansions: 5-year native support established for IDP & IDDMP cohorts up to Semester 10.
- [x] Timetable Architecture: Replaced hardcoded string fields with explicit UUID linkages to the `subjects` table.

📝 **Sprint 3: Recommendations (Pending User Approval)**
- [x] Security Enhancement: Implement `express-rate-limit` on the `/api/auth/student-lookup` route to prevent brute-force dictionary attacks against valid roll numbers.
- [ ] Feature: Automated Threshold emails for student attendance dips (Will require standardizing a CRON architecture/Edge Function).
- [x] Security Enhancement: Ensure File Upload payloads on `/api/timetables/uploads` natively stream to Supabase rather than utilizing Node heap memory caching to prevent DoS against the backend server.