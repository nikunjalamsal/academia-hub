-- Add is_active column to materials table for soft delete
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add RLS policy for soft-deleting materials (update is_active)
-- Teachers can soft-delete their own materials
CREATE POLICY "Teachers can soft delete own materials"
ON public.materials
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM teachers t WHERE t.user_id = auth.uid() AND t.id = materials.teacher_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM teachers t WHERE t.user_id = auth.uid() AND t.id = materials.teacher_id
));

-- Admins can soft-delete any teacher/student
-- (already covered by existing "Admins can manage" policies)

-- Add RLS policy for teachers to soft-delete their own assignments
CREATE POLICY "Teachers can soft delete own assignments"
ON public.assignments
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM teachers t WHERE t.user_id = auth.uid() AND t.id = assignments.teacher_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM teachers t WHERE t.user_id = auth.uid() AND t.id = assignments.teacher_id
));