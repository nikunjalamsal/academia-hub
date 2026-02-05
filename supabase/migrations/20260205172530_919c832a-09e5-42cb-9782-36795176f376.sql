-- Add UPDATE policies for admin to manage students, teachers, profiles

-- Admin can update students
CREATE POLICY "Admins can update students"
ON public.students
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update teachers
CREATE POLICY "Admins can update teachers"
ON public.teachers
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policies for assignments - teachers can update their own, admin can update all
CREATE POLICY "Admins can manage all assignments"
ON public.assignments
AS PERMISSIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add UPDATE policies for materials - teachers can update their own, admin can update all  
CREATE POLICY "Admins can manage all materials"
ON public.materials
AS PERMISSIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add INSERT policy for courses - admin can create courses
CREATE POLICY "Admins can create courses"
ON public.courses
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add INSERT policy for semesters - admin can create semesters
CREATE POLICY "Admins can create semesters"
ON public.semesters
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add INSERT policy for subjects - admin can create subjects
CREATE POLICY "Admins can create subjects"
ON public.subjects
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));