
-- Create a security definer function to get student's semester_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_student_semester_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT current_semester_id FROM public.students WHERE user_id = p_user_id AND is_active = true LIMIT 1;
$$;

-- Drop the problematic recursive policy on students
DROP POLICY IF EXISTS "Students can view peers in same semester" ON public.students;

-- Recreate it using the security definer function (no self-join on students)
CREATE POLICY "Students can view peers in same semester"
ON public.students
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND current_semester_id = get_student_semester_id(auth.uid())
  AND is_active = true
);

-- Also fix the profiles peer policy that may cause recursion
DROP POLICY IF EXISTS "Students can view peer profiles" ON public.profiles;

CREATE POLICY "Students can view peer profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.students peer
    WHERE peer.user_id = profiles.user_id
      AND peer.is_active = true
      AND peer.current_semester_id = get_student_semester_id(auth.uid())
  )
);
