-- Drop the existing unique constraint on roll_number
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_roll_number_key;

-- Create composite unique constraint on roll_number + course_id (same roll number allowed in different courses)
CREATE UNIQUE INDEX students_roll_number_course_unique ON public.students (roll_number, course_id);

-- Add subject_id column to teacher_semester_assignments for proper subject linking
ALTER TABLE public.teacher_semester_assignments ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_teacher_semester_assignments_subject ON public.teacher_semester_assignments(subject_id);