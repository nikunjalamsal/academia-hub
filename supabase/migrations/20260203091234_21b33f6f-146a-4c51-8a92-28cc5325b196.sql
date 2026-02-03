-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

-- Create profiles table for user data
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    must_change_password BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Create courses table (e.g., BCA)
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    duration_years INTEGER NOT NULL DEFAULT 4,
    total_semesters INTEGER NOT NULL DEFAULT 8,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create semesters table
CREATE TABLE public.semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    semester_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (course_id, semester_number)
);

-- Create teachers table
CREATE TABLE public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    employee_id TEXT NOT NULL UNIQUE,
    department TEXT,
    designation TEXT,
    qualification TEXT,
    joining_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create teacher_semester_assignments (which teacher teaches which semester)
CREATE TABLE public.teacher_semester_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
    semester_id UUID REFERENCES public.semesters(id) ON DELETE CASCADE NOT NULL,
    subject_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (teacher_id, semester_id, subject_name)
);

-- Create students table
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    roll_number TEXT NOT NULL UNIQUE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    current_semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL,
    enrollment_year INTEGER NOT NULL,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    guardian_name TEXT,
    guardian_phone TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create subjects table
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    semester_id UUID REFERENCES public.semesters(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    credits INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (semester_id, code)
);

-- Create materials table (study materials uploaded by teachers)
CREATE TABLE public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
    semester_id UUID REFERENCES public.semesters(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create assignments table
CREATE TABLE public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
    semester_id UUID REFERENCES public.semesters(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_name TEXT,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    max_marks INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create assignment submissions table
CREATE TABLE public.assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT,
    file_name TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    marks_obtained INTEGER,
    feedback TEXT,
    graded_at TIMESTAMP WITH TIME ZONE,
    graded_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    UNIQUE (assignment_id, student_id)
);

-- Create attendance table
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    semester_id UUID REFERENCES public.semesters(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (student_id, date, subject_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_semester_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles" ON public.profiles
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for courses
CREATE POLICY "Anyone authenticated can view courses" ON public.courses
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage courses" ON public.courses
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for semesters
CREATE POLICY "Anyone authenticated can view semesters" ON public.semesters
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage semesters" ON public.semesters
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for teachers
CREATE POLICY "Teachers can view own data" ON public.teachers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone authenticated can view teachers" ON public.teachers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage teachers" ON public.teachers
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for teacher_semester_assignments
CREATE POLICY "Anyone authenticated can view teacher assignments" ON public.teacher_semester_assignments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage teacher assignments" ON public.teacher_semester_assignments
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for students
CREATE POLICY "Students can view own data" ON public.students
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Teachers can view students in their semesters" ON public.students
    FOR SELECT USING (
        public.has_role(auth.uid(), 'teacher') AND
        EXISTS (
            SELECT 1 FROM public.teachers t
            JOIN public.teacher_semester_assignments tsa ON t.id = tsa.teacher_id
            WHERE t.user_id = auth.uid()
            AND tsa.semester_id = current_semester_id
        )
    );

CREATE POLICY "Admins can manage students" ON public.students
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for subjects
CREATE POLICY "Anyone authenticated can view subjects" ON public.subjects
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage subjects" ON public.subjects
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for materials
CREATE POLICY "Students can view materials for their semester" ON public.materials
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.user_id = auth.uid()
            AND s.current_semester_id = semester_id
        )
    );

CREATE POLICY "Teachers can view own materials" ON public.materials
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.teachers t
            WHERE t.user_id = auth.uid()
            AND t.id = teacher_id
        )
    );

CREATE POLICY "Teachers can manage own materials" ON public.materials
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.teachers t
            WHERE t.user_id = auth.uid()
            AND t.id = teacher_id
        )
    );

CREATE POLICY "Admins can view all materials" ON public.materials
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for assignments
CREATE POLICY "Students can view assignments for their semester" ON public.assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.user_id = auth.uid()
            AND s.current_semester_id = semester_id
        )
    );

CREATE POLICY "Teachers can manage own assignments" ON public.assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.teachers t
            WHERE t.user_id = auth.uid()
            AND t.id = teacher_id
        )
    );

CREATE POLICY "Admins can view all assignments" ON public.assignments
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for assignment_submissions
CREATE POLICY "Students can view own submissions" ON public.assignment_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.user_id = auth.uid()
            AND s.id = student_id
        )
    );

CREATE POLICY "Students can submit own assignments" ON public.assignment_submissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.user_id = auth.uid()
            AND s.id = student_id
        )
    );

CREATE POLICY "Teachers can view/grade submissions for their assignments" ON public.assignment_submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.assignments a
            JOIN public.teachers t ON a.teacher_id = t.id
            WHERE t.user_id = auth.uid()
            AND a.id = assignment_id
        )
    );

CREATE POLICY "Admins can view all submissions" ON public.assignment_submissions
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for attendance
CREATE POLICY "Students can view own attendance" ON public.attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.user_id = auth.uid()
            AND s.id = student_id
        )
    );

CREATE POLICY "Students can view attendance of their semester peers" ON public.attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.students s
            JOIN public.students peer ON s.current_semester_id = peer.current_semester_id
            WHERE s.user_id = auth.uid()
            AND peer.id = student_id
        )
    );

CREATE POLICY "Teachers can manage attendance for their semesters" ON public.attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.teachers t
            JOIN public.teacher_semester_assignments tsa ON t.id = tsa.teacher_id
            WHERE t.user_id = auth.uid()
            AND tsa.semester_id = semester_id
        )
    );

CREATE POLICY "Admins can manage all attendance" ON public.attendance
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default BCA course with 8 semesters
INSERT INTO public.courses (name, code, duration_years, total_semesters, description)
VALUES ('Bachelor of Computer Applications', 'BCA', 4, 8, 'A 4-year undergraduate program in computer applications');

-- Insert 8 semesters for BCA
DO $$
DECLARE
    course_id UUID;
BEGIN
    SELECT id INTO course_id FROM public.courses WHERE code = 'BCA';
    
    INSERT INTO public.semesters (course_id, semester_number, name) VALUES
        (course_id, 1, 'Semester 1'),
        (course_id, 2, 'Semester 2'),
        (course_id, 3, 'Semester 3'),
        (course_id, 4, 'Semester 4'),
        (course_id, 5, 'Semester 5'),
        (course_id, 6, 'Semester 6'),
        (course_id, 7, 'Semester 7'),
        (course_id, 8, 'Semester 8');
END $$;

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('academic-files', 'academic-files', true);

-- Storage policies
CREATE POLICY "Anyone authenticated can view academic files" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'academic-files');

CREATE POLICY "Teachers can upload academic files" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'academic-files' AND
        (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'))
    );

CREATE POLICY "Students can upload submissions" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'academic-files' AND
        public.has_role(auth.uid(), 'student') AND
        (storage.foldername(name))[1] = 'submissions'
    );

CREATE POLICY "Teachers and admins can delete own files" ON storage.objects
    FOR DELETE TO authenticated USING (
        bucket_id = 'academic-files' AND
        (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'))
    );