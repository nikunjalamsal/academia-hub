-- Allow teachers to view profiles of students in their assigned semesters
CREATE POLICY "Teachers can view profiles of their students"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND
  EXISTS (
    SELECT 1
    FROM students s
    JOIN teachers t ON t.user_id = auth.uid()
    JOIN teacher_semester_assignments tsa ON tsa.teacher_id = t.id
    WHERE s.user_id = profiles.user_id
    AND s.current_semester_id = tsa.semester_id
    AND tsa.is_active = true
  )
);

-- Allow teachers to view profiles of other teachers (for faculty directory)
CREATE POLICY "Teachers can view teacher profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND
  EXISTS (
    SELECT 1 FROM teachers t WHERE t.user_id = profiles.user_id
  )
);