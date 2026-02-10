-- Allow students to view teacher profiles in the faculty directory
CREATE POLICY "Students can view teacher profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1 FROM teachers t WHERE t.user_id = profiles.user_id AND t.is_active = true
  )
);