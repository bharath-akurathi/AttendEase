-- Supabase Schema for Attendance Management System

-- 0. Clean slate (Drop existing tables if any)
DROP TABLE IF EXISTS public.timetables CASCADE;
DROP TABLE IF EXISTS public.absence_records CASCADE;
DROP TABLE IF EXISTS public.class_enrollments CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('teacher', 'student', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create tables
-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class Enrollments table (links students to classes)
CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

-- Absence Records table (Only tracking ABSENT students)
CREATE TABLE IF NOT EXISTS public.absence_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- teacher who marked it
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id, date)
);

-- Timetables table
CREATE TABLE IF NOT EXISTS public.timetables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  class_name TEXT NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday...
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT timetable_time_check CHECK (start_time < end_time)
);

-- Timetable Uploads table (photo/PDF uploads)
DROP TABLE IF EXISTS public.timetable_uploads CASCADE;
CREATE TABLE IF NOT EXISTS public.timetable_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_uploads ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Profiles: Users can read all profiles (needed for class lists), but only update their own
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users" 
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Classes: Anyone can read classes, only teachers can create/update their own
DROP POLICY IF EXISTS "Classes are viewable by authenticated users" ON public.classes;
CREATE POLICY "Classes are viewable by authenticated users" 
ON public.classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can insert their own classes" ON public.classes;
CREATE POLICY "Teachers can insert their own classes" 
ON public.classes FOR INSERT TO authenticated 
WITH CHECK (
  auth.uid() = teacher_id AND 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
);

DROP POLICY IF EXISTS "Teachers can update their own classes" ON public.classes;
CREATE POLICY "Teachers can update their own classes" 
ON public.classes FOR UPDATE TO authenticated 
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete their own classes" ON public.classes;
CREATE POLICY "Teachers can delete their own classes" 
ON public.classes FOR DELETE TO authenticated 
USING (auth.uid() = teacher_id);

-- Class Enrollments: Viewable by authenticated users, manageable by teachers
DROP POLICY IF EXISTS "Enrollments are viewable by authenticated users" ON public.class_enrollments;
CREATE POLICY "Enrollments are viewable by authenticated users" 
ON public.class_enrollments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can manage enrollments for their classes" ON public.class_enrollments;
CREATE POLICY "Teachers can manage enrollments for their classes"
ON public.class_enrollments FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes 
    WHERE id = class_id AND teacher_id = auth.uid()
  )
);

-- Absence Records: 
-- Teachers can manage absences for their classes
-- Students can only read their own absences
DROP POLICY IF EXISTS "Teachers can insert absences for their classes" ON public.absence_records;
CREATE POLICY "Teachers can insert absences for their classes"
ON public.absence_records FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes 
    WHERE id = class_id AND teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can view absences for their classes" ON public.absence_records;
CREATE POLICY "Teachers can view absences for their classes"
ON public.absence_records FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes 
    WHERE id = class_id AND teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can delete absences for their classes" ON public.absence_records;
CREATE POLICY "Teachers can delete absences for their classes"
ON public.absence_records FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes 
    WHERE id = class_id AND teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Students can view their own absences" ON public.absence_records;
CREATE POLICY "Students can view their own absences"
ON public.absence_records FOR SELECT TO authenticated
USING (student_id = auth.uid());

-- Timetables: 
-- Anyone can read, teachers can manage their own
DROP POLICY IF EXISTS "Timetables are viewable by authenticated users" ON public.timetables;
CREATE POLICY "Timetables are viewable by authenticated users" 
ON public.timetables FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can insert their own timetables" ON public.timetables;
CREATE POLICY "Teachers can insert their own timetables" 
ON public.timetables FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = teacher_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'));

DROP POLICY IF EXISTS "Teachers can update their own timetables" ON public.timetables;
CREATE POLICY "Teachers can update their own timetables" 
ON public.timetables FOR UPDATE TO authenticated 
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete their own timetables" ON public.timetables;
CREATE POLICY "Teachers can delete their own timetables" 
ON public.timetables FOR DELETE TO authenticated 
USING (auth.uid() = teacher_id);

-- Timetable Uploads:
-- Anyone can read, teachers/admins can manage
DROP POLICY IF EXISTS "Timetable uploads are viewable by authenticated users" ON public.timetable_uploads;
CREATE POLICY "Timetable uploads are viewable by authenticated users" 
ON public.timetable_uploads FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can insert their own timetable uploads" ON public.timetable_uploads;
CREATE POLICY "Teachers can insert their own timetable uploads" 
ON public.timetable_uploads FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = uploaded_by AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin')));

DROP POLICY IF EXISTS "Teachers can update their own timetable uploads" ON public.timetable_uploads;
CREATE POLICY "Teachers can update their own timetable uploads" 
ON public.timetable_uploads FOR UPDATE TO authenticated 
USING (auth.uid() = uploaded_by)
WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Teachers can delete their own timetable uploads" ON public.timetable_uploads;
CREATE POLICY "Teachers can delete their own timetable uploads" 
ON public.timetable_uploads FOR DELETE TO authenticated 
USING (auth.uid() = uploaded_by);

-- Admin Global Policies (Bypass all)
-- Use a SECURITY DEFINER function to bypass RLS and prevent infinite recursion
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

-- Admins get ALL access to all tables
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
CREATE POLICY "Admins have full access to profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins have full access to classes" ON public.classes;
CREATE POLICY "Admins have full access to classes" ON public.classes FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins have full access to class_enrollments" ON public.class_enrollments;
CREATE POLICY "Admins have full access to class_enrollments" ON public.class_enrollments FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins have full access to absence_records" ON public.absence_records;
CREATE POLICY "Admins have full access to absence_records" ON public.absence_records FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins have full access to timetables" ON public.timetables;
CREATE POLICY "Admins have full access to timetables" ON public.timetables FOR ALL TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins have full access to timetable_uploads" ON public.timetable_uploads;
CREATE POLICY "Admins have full access to timetable_uploads" ON public.timetable_uploads FOR ALL TO authenticated USING (public.is_admin());


-- 5. Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_classes_updated_at ON public.classes;
CREATE TRIGGER update_classes_updated_at
    BEFORE UPDATE ON public.classes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_timetables_updated_at ON public.timetables;
CREATE TRIGGER update_timetables_updated_at
    BEFORE UPDATE ON public.timetables
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_timetable_uploads_updated_at ON public.timetable_uploads;
CREATE TRIGGER update_timetable_uploads_updated_at
    BEFORE UPDATE ON public.timetable_uploads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Trigger to automatically create a profile after signup
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. RPC Functions for Admin Statistics
CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS json
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_users INT;
  total_teachers INT;
  total_students INT;
  total_classes INT;
  total_absences INT;
BEGIN
  SELECT count(*) INTO total_users FROM public.profiles;
  SELECT count(*) INTO total_teachers FROM public.profiles WHERE role = 'teacher';
  SELECT count(*) INTO total_students FROM public.profiles WHERE role = 'student';
  SELECT count(*) INTO total_classes FROM public.classes;
  SELECT count(*) INTO total_absences FROM public.absence_records;
  
  RETURN json_build_object(
    'total_users', total_users,
    'total_teachers', total_teachers,
    'total_students', total_students,
    'total_classes', total_classes,
    'total_absences', total_absences
  );
END;
$$ LANGUAGE plpgsql;
