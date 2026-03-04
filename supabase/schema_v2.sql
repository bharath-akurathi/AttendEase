-- ============================================================
-- AttendEase V2 Schema — JNTUH Edition
-- ============================================================
-- Migration from V1: drops classes, class_enrollments
-- Creates: regulations, courses, subjects, subject_enrollments
-- Alters: profiles, absence_records, timetables, timetable_uploads
-- ============================================================

-- ============================================================
-- 0. Drop old V1 tables (no data to preserve)
-- ============================================================
DROP TABLE IF EXISTS public.timetable_uploads CASCADE;
DROP TABLE IF EXISTS public.timetables CASCADE;
DROP TABLE IF EXISTS public.absence_records CASCADE;
DROP TABLE IF EXISTS public.class_enrollments CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;

-- ============================================================
-- 1. Custom Types
-- ============================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('teacher', 'student', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE course_type AS ENUM ('btech', 'mtech', 'idp');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. New Tables: Academic Hierarchy
-- ============================================================

-- Regulations (R18, R22, etc.)
CREATE TABLE IF NOT EXISTS public.regulations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses under regulations
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    regulation_id UUID REFERENCES public.regulations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    type course_type NOT NULL DEFAULT 'btech',
    total_semesters INT NOT NULL DEFAULT 8,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(regulation_id, code)
);

-- ============================================================
-- 3. Alter Profiles (add JNTUH fields)
-- ============================================================
-- Add new columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roll_number TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS regulation_id UUID REFERENCES public.regulations(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_year INT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_semester INT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_id TEXT;

-- ============================================================
-- 4. Subjects (replaces classes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    regulation_id UUID REFERENCES public.regulations(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    year INT NOT NULL CHECK (year >= 1 AND year <= 6),
    semester INT NOT NULL CHECK (semester >= 1 AND semester <= 2),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    section TEXT,
    credits INT DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(regulation_id, course_id, year, semester, code, COALESCE(section, ''))
);

-- Subject Enrollments (replaces class_enrollments)
CREATE TABLE IF NOT EXISTS public.subject_enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_id, student_id)
);

-- ============================================================
-- 5. Recreate Absence Records (FK → subjects)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.absence_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_id, student_id, date)
);

-- ============================================================
-- 6. Recreate Timetables (FK → subjects)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.timetables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT timetable_time_check CHECK (start_time < end_time)
);

-- ============================================================
-- 7. Recreate Timetable Uploads (FK → subjects optional)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.timetable_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. Enable Row Level Security
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_uploads ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. Functions
-- ============================================================

-- is_admin() — SECURITY DEFINER to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql;

-- is_teacher() — helper
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'teacher'
    );
END;
$$ LANGUAGE plpgsql;

-- update_updated_at_column() — auto-timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- handle_new_user() — auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Unnamed User'),
        COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role)
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql;

-- resolve_roll_number() — map roll number to auth UUID
CREATE OR REPLACE FUNCTION public.resolve_roll_number(roll_no TEXT)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id UUID;
BEGIN
    SELECT id INTO user_id
    FROM public.profiles
    WHERE roll_number = roll_no;
    RETURN user_id;
END;
$$ LANGUAGE plpgsql;

-- get_system_stats() — admin statistics
CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS json
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_users INT;
    total_teachers INT;
    total_students INT;
    total_subjects INT;
    total_regulations INT;
    total_courses INT;
    total_absences INT;
    absences_today INT;
BEGIN
    SELECT count(*) INTO total_users FROM public.profiles;
    SELECT count(*) INTO total_teachers FROM public.profiles WHERE role = 'teacher';
    SELECT count(*) INTO total_students FROM public.profiles WHERE role = 'student';
    SELECT count(*) INTO total_subjects FROM public.subjects WHERE is_active = true;
    SELECT count(*) INTO total_regulations FROM public.regulations WHERE is_active = true;
    SELECT count(*) INTO total_courses FROM public.courses WHERE is_active = true;
    SELECT count(*) INTO total_absences FROM public.absence_records;
    SELECT count(*) INTO absences_today FROM public.absence_records WHERE date = CURRENT_DATE;

    RETURN json_build_object(
        'total_users', total_users,
        'total_teachers', total_teachers,
        'total_students', total_students,
        'total_subjects', total_subjects,
        'total_regulations', total_regulations,
        'total_courses', total_courses,
        'total_absences', total_absences,
        'absences_today', absences_today
    );
END;
$$ LANGUAGE plpgsql;

-- get_student_attendance() — per-subject summary for a student-semester
CREATE OR REPLACE FUNCTION public.get_student_attendance(
    p_student_id UUID,
    p_year INT DEFAULT NULL,
    p_semester INT DEFAULT NULL,
    p_course_id UUID DEFAULT NULL,
    p_regulation_id UUID DEFAULT NULL
)
RETURNS json
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_agg(row_to_json(t))
    INTO result
    FROM (
        SELECT
            s.id AS subject_id,
            s.name AS subject_name,
            s.code AS subject_code,
            s.year,
            s.semester,
            s.credits,
            (SELECT count(*) FROM public.absence_records ar WHERE ar.subject_id = s.id AND ar.student_id = p_student_id) AS total_absences,
            p2.full_name AS teacher_name
        FROM public.subject_enrollments se
        JOIN public.subjects s ON s.id = se.subject_id
        LEFT JOIN public.profiles p2 ON p2.id = s.teacher_id
        WHERE se.student_id = p_student_id
            AND (p_year IS NULL OR s.year = p_year)
            AND (p_semester IS NULL OR s.semester = p_semester)
            AND (p_course_id IS NULL OR s.course_id = p_course_id)
            AND (p_regulation_id IS NULL OR s.regulation_id = p_regulation_id)
        ORDER BY s.year, s.semester, s.name
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 10. RLS Policies
-- ============================================================

-- ---------- PROFILES ----------
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
CREATE POLICY "Admins have full access to profiles"
ON public.profiles FOR ALL TO authenticated USING (public.is_admin());

-- ---------- REGULATIONS ----------
DROP POLICY IF EXISTS "Regulations are viewable by authenticated users" ON public.regulations;
CREATE POLICY "Regulations are viewable by authenticated users"
ON public.regulations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage regulations" ON public.regulations;
CREATE POLICY "Admins can manage regulations"
ON public.regulations FOR ALL TO authenticated USING (public.is_admin());

-- ---------- COURSES ----------
DROP POLICY IF EXISTS "Courses are viewable by authenticated users" ON public.courses;
CREATE POLICY "Courses are viewable by authenticated users"
ON public.courses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage courses" ON public.courses;
CREATE POLICY "Admins can manage courses"
ON public.courses FOR ALL TO authenticated USING (public.is_admin());

-- ---------- SUBJECTS ----------
DROP POLICY IF EXISTS "Subjects are viewable by authenticated users" ON public.subjects;
CREATE POLICY "Subjects are viewable by authenticated users"
ON public.subjects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can insert their own subjects" ON public.subjects;
CREATE POLICY "Teachers can insert their own subjects"
ON public.subjects FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = teacher_id AND public.is_teacher()
);

DROP POLICY IF EXISTS "Teachers can update their own subjects" ON public.subjects;
CREATE POLICY "Teachers can update their own subjects"
ON public.subjects FOR UPDATE TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete their own subjects" ON public.subjects;
CREATE POLICY "Teachers can delete their own subjects"
ON public.subjects FOR DELETE TO authenticated
USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Admins have full access to subjects" ON public.subjects;
CREATE POLICY "Admins have full access to subjects"
ON public.subjects FOR ALL TO authenticated USING (public.is_admin());

-- ---------- SUBJECT ENROLLMENTS ----------
DROP POLICY IF EXISTS "Enrollments are viewable by authenticated users" ON public.subject_enrollments;
CREATE POLICY "Enrollments are viewable by authenticated users"
ON public.subject_enrollments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can manage enrollments for their subjects" ON public.subject_enrollments;
CREATE POLICY "Teachers can manage enrollments for their subjects"
ON public.subject_enrollments FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.subjects
        WHERE id = subject_id AND teacher_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Admins have full access to subject_enrollments" ON public.subject_enrollments;
CREATE POLICY "Admins have full access to subject_enrollments"
ON public.subject_enrollments FOR ALL TO authenticated USING (public.is_admin());

-- ---------- ABSENCE RECORDS ----------
DROP POLICY IF EXISTS "Teachers can insert absences for their subjects" ON public.absence_records;
CREATE POLICY "Teachers can insert absences for their subjects"
ON public.absence_records FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.subjects
        WHERE id = subject_id AND teacher_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Teachers can view absences for their subjects" ON public.absence_records;
CREATE POLICY "Teachers can view absences for their subjects"
ON public.absence_records FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.subjects
        WHERE id = subject_id AND teacher_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Teachers can delete absences for their subjects" ON public.absence_records;
CREATE POLICY "Teachers can delete absences for their subjects"
ON public.absence_records FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.subjects
        WHERE id = subject_id AND teacher_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Students can view their own absences" ON public.absence_records;
CREATE POLICY "Students can view their own absences"
ON public.absence_records FOR SELECT TO authenticated
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to absence_records" ON public.absence_records;
CREATE POLICY "Admins have full access to absence_records"
ON public.absence_records FOR ALL TO authenticated USING (public.is_admin());

-- ---------- TIMETABLES ----------
DROP POLICY IF EXISTS "Timetables are viewable by authenticated users" ON public.timetables;
CREATE POLICY "Timetables are viewable by authenticated users"
ON public.timetables FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can insert their own timetables" ON public.timetables;
CREATE POLICY "Teachers can insert their own timetables"
ON public.timetables FOR INSERT TO authenticated
WITH CHECK (auth.uid() = teacher_id AND public.is_teacher());

DROP POLICY IF EXISTS "Teachers can update their own timetables" ON public.timetables;
CREATE POLICY "Teachers can update their own timetables"
ON public.timetables FOR UPDATE TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete their own timetables" ON public.timetables;
CREATE POLICY "Teachers can delete their own timetables"
ON public.timetables FOR DELETE TO authenticated
USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Admins have full access to timetables" ON public.timetables;
CREATE POLICY "Admins have full access to timetables"
ON public.timetables FOR ALL TO authenticated USING (public.is_admin());

-- ---------- TIMETABLE UPLOADS ----------
DROP POLICY IF EXISTS "Timetable uploads are viewable by authenticated users" ON public.timetable_uploads;
CREATE POLICY "Timetable uploads are viewable by authenticated users"
ON public.timetable_uploads FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can insert their own timetable uploads" ON public.timetable_uploads;
CREATE POLICY "Teachers can insert their own timetable uploads"
ON public.timetable_uploads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = uploaded_by AND (public.is_teacher() OR public.is_admin()));

DROP POLICY IF EXISTS "Teachers can update their own timetable uploads" ON public.timetable_uploads;
CREATE POLICY "Teachers can update their own timetable uploads"
ON public.timetable_uploads FOR UPDATE TO authenticated
USING (auth.uid() = uploaded_by)
WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Teachers can delete their own timetable uploads" ON public.timetable_uploads;
CREATE POLICY "Teachers can delete their own timetable uploads"
ON public.timetable_uploads FOR DELETE TO authenticated
USING (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Admins have full access to timetable_uploads" ON public.timetable_uploads;
CREATE POLICY "Admins have full access to timetable_uploads"
ON public.timetable_uploads FOR ALL TO authenticated USING (public.is_admin());


-- ============================================================
-- 11. Triggers
-- ============================================================

-- updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_courses_updated_at ON public.courses;
CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subjects_updated_at ON public.subjects;
CREATE TRIGGER update_subjects_updated_at
    BEFORE UPDATE ON public.subjects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_timetables_updated_at ON public.timetables;
CREATE TRIGGER update_timetables_updated_at
    BEFORE UPDATE ON public.timetables
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_timetable_uploads_updated_at ON public.timetable_uploads;
CREATE TRIGGER update_timetable_uploads_updated_at
    BEFORE UPDATE ON public.timetable_uploads
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- 12. Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON public.subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_subjects_regulation_course ON public.subjects(regulation_id, course_id, year, semester);
CREATE INDEX IF NOT EXISTS idx_subject_enrollments_student ON public.subject_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_subject_enrollments_subject ON public.subject_enrollments(subject_id);
CREATE INDEX IF NOT EXISTS idx_absence_records_subject_date ON public.absence_records(subject_id, date);
CREATE INDEX IF NOT EXISTS idx_absence_records_student ON public.absence_records(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_roll_number ON public.profiles(roll_number) WHERE roll_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_courses_regulation ON public.courses(regulation_id);
