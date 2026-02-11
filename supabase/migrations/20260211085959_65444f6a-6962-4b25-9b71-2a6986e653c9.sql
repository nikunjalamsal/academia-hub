-- Allow students to view other students in the same semester
CREATE POLICY "Students can view peers in same semester"
ON public.students
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role) AND
  EXISTS (
    SELECT 1 FROM students s
    WHERE s.user_id = auth.uid()
    AND s.current_semester_id = students.current_semester_id
    AND s.is_active = true
  )
);

-- Allow students to view profiles of peers
CREATE POLICY "Students can view peer profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role) AND
  EXISTS (
    SELECT 1 FROM students peer
    JOIN students self ON self.current_semester_id = peer.current_semester_id
    WHERE self.user_id = auth.uid()
    AND peer.user_id = profiles.user_id
    AND peer.is_active = true
    AND self.is_active = true
  )
);
