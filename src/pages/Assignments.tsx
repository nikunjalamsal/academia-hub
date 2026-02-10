import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Plus, Loader2, Calendar, FileText, Upload, Download, Edit, Trash2 } from 'lucide-react';
import { Assignment, Semester, Teacher, Student, Course } from '@/types/database';
import { format } from 'date-fns';

export default function Assignments() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [deleteAssignmentId, setDeleteAssignmentId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  const [formData, setFormData] = useState({ title: '', description: '', semester_id: '', due_date: '', max_marks: 100 });
  const [editFormData, setEditFormData] = useState({ title: '', description: '', semester_id: '', due_date: '', max_marks: 100 });
  const [editFile, setEditFile] = useState<File | null>(null);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<any[]>([]);
  const [viewSubmissionsId, setViewSubmissionsId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, [user, role]);

  const fetchData = async () => {
    try {
      if (role === 'teacher' && user) {
        const { data: teacherData } = await supabase.from('teachers').select('*').eq('user_id', user.id).maybeSingle();
        if (teacherData) {
          setTeacher(teacherData as Teacher);

          const { data: assignmentsData } = await supabase.from('teacher_semester_assignments').select('semester_id').eq('teacher_id', teacherData.id);
          const semesterIds = assignmentsData?.map(a => a.semester_id) || [];

          const { data } = await supabase.from('assignments').select('*, semester:semesters(*, course:courses(*))').eq('teacher_id', teacherData.id).eq('is_active', true).order('due_date', { ascending: false });
          if (data) setAssignments(data as Assignment[]);

          const { data: semData } = await supabase.from('semesters').select('*, course:courses(*)').in('id', semesterIds);
          if (semData) {
            setSemesters(semData as Semester[]);
            const courseMap = new Map<string, Course>();
            semData.forEach((s: any) => { if (s.course) courseMap.set(s.course.id, s.course); });
            setCourses(Array.from(courseMap.values()));
          }
        }
      } else if (role === 'student' && user) {
        const { data: studentData } = await supabase.from('students').select('*').eq('user_id', user.id).maybeSingle();
        if (studentData) {
          setStudent(studentData as Student);
          const { data } = await supabase.from('assignments').select('*, semester:semesters(*), teacher:teachers(*, profile:profiles(*))').eq('semester_id', studentData.current_semester_id).eq('is_active', true).order('due_date', { ascending: true });
          if (data) setAssignments(data as Assignment[]);

          const { data: subData } = await supabase.from('assignment_submissions').select('assignment_id').eq('student_id', studentData.id);
          const subMap: Record<string, boolean> = {};
          subData?.forEach(s => { subMap[s.assignment_id] = true; });
          setSubmissions(subMap);
        }
      } else if (role === 'admin') {
        const [assignmentsRes, semestersRes, coursesRes] = await Promise.all([
          supabase.from('assignments').select('*, semester:semesters(*, course:courses(*)), teacher:teachers(*, profile:profiles(*))').eq('is_active', true).order('due_date', { ascending: false }),
          supabase.from('semesters').select('*, course:courses(*)').order('semester_number'),
          supabase.from('courses').select('*').eq('is_active', true),
        ]);
        if (assignmentsRes.data) setAssignments(assignmentsRes.data as Assignment[]);
        if (semestersRes.data) setSemesters(semestersRes.data as Semester[]);
        if (coursesRes.data) setCourses(coursesRes.data as Course[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally { setIsLoading(false); }
  };

  const handleFileUpload = async (file: File) => {
    if (!teacher) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `assignments/${teacher.id}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('academic-files').upload(fileName, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('academic-files').getPublicUrl(fileName);
    return { url: publicUrl, name: file.name };
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;
    setIsCreating(true);
    try {
      let fileData = null;
      if (selectedFile) { setUploadingFile(true); fileData = await handleFileUpload(selectedFile); setUploadingFile(false); }
      const { error } = await supabase.from('assignments').insert({
        teacher_id: teacher.id, semester_id: formData.semester_id, title: formData.title,
        description: formData.description, due_date: formData.due_date, max_marks: formData.max_marks,
        file_url: fileData?.url, file_name: fileData?.name,
      });
      if (error) throw error;
      toast({ title: 'Assignment Created', description: 'The assignment has been created successfully.' });
      setIsDialogOpen(false);
      setFormData({ title: '', description: '', semester_id: '', due_date: '', max_marks: 100 });
      setSelectedFile(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setIsCreating(false); }
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setEditFormData({
      title: assignment.title, description: assignment.description || '', semester_id: assignment.semester_id,
      due_date: format(new Date(assignment.due_date), "yyyy-MM-dd'T'HH:mm"), max_marks: assignment.max_marks,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment) return;
    setIsUpdating(true);
    try {
      let fileData = null;
      if (editFile) {
        const fileExt = editFile.name.split('.').pop();
        const fileName = `assignments/${teacher?.id || 'admin'}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('academic-files').upload(fileName, editFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('academic-files').getPublicUrl(fileName);
        fileData = { url: publicUrl, name: editFile.name };
      }
      const updateData: any = {
        title: editFormData.title, description: editFormData.description, semester_id: editFormData.semester_id,
        due_date: editFormData.due_date, max_marks: editFormData.max_marks,
      };
      if (fileData) { updateData.file_url = fileData.url; updateData.file_name = fileData.name; }
      const { error } = await supabase.from('assignments').update(updateData).eq('id', editingAssignment.id);
      if (error) throw error;
      toast({ title: 'Assignment Updated', description: 'The assignment has been updated successfully.' });
      setIsEditDialogOpen(false);
      setEditingAssignment(null);
      setEditFile(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setIsUpdating(false); }
  };

  const handleDeleteAssignment = async () => {
    if (!deleteAssignmentId) return;
    try {
      const { error } = await supabase.from('assignments').update({ is_active: false }).eq('id', deleteAssignmentId);
      if (error) throw error;
      toast({ title: 'Assignment Deactivated', description: 'The assignment has been deactivated.' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setDeleteAssignmentId(null); }
  };

  const handleViewSubmissions = async (assignmentId: string) => {
    setViewSubmissionsId(assignmentId);
    try {
      const { data } = await supabase
        .from('assignment_submissions')
        .select('*, student:students(*, profile:profiles(*))')
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });
      setAssignmentSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const handleSubmitAssignment = async (assignmentId: string, file: File) => {
    if (!student) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `submissions/${student.id}/${assignmentId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('academic-files').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('academic-files').getPublicUrl(fileName);
      const { error } = await supabase.from('assignment_submissions').insert({
        assignment_id: assignmentId, student_id: student.id, file_url: publicUrl, file_name: file.name,
      });
      if (error) throw error;
      toast({ title: 'Assignment Submitted', description: 'Your assignment has been submitted successfully.' });
      setSubmissions({ ...submissions, [assignmentId]: true });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';
  const isAdmin = role === 'admin';
  const canEdit = isTeacher || isAdmin;

  // Filter semesters by selected course for the create form
  const formFilteredSemesters = selectedCourse ? semesters.filter(s => s.course_id === selectedCourse) : semesters;

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-warning" />
            Assignments
          </h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher ? 'Create and manage assignments' : isStudent ? 'View and submit assignments' : 'All assignments'}
          </p>
        </div>
        {isTeacher && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Create Assignment</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create New Assignment</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateAssignment} className="space-y-4 mt-4">
                <div className="space-y-2"><Label htmlFor="title">Title *</Label><Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required /></div>
                {courses.length > 0 && (
                  <div className="space-y-2">
                    <Label>Course</Label>
                    <Select value={selectedCourse} onValueChange={(v) => { setSelectedCourse(v); setFormData({ ...formData, semester_id: '' }); }}>
                      <SelectTrigger><SelectValue placeholder="Filter by course" /></SelectTrigger>
                      <SelectContent>{courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="semester_id">Semester *</Label>
                  <Select value={formData.semester_id} onValueChange={(value) => setFormData({ ...formData, semester_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                    <SelectContent>{formFilteredSemesters.map((semester) => (<SelectItem key={semester.id} value={semester.id}>{semester.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="due_date">Due Date *</Label><Input id="due_date" type="datetime-local" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="max_marks">Max Marks</Label><Input id="max_marks" type="number" value={formData.max_marks} onChange={(e) => setFormData({ ...formData, max_marks: parseInt(e.target.value) })} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="file">Attachment (Optional)</Label><Input id="file" type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} /></div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isCreating}>{isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{uploadingFile ? 'Uploading...' : 'Creating...'}</> : 'Create'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Assignment</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateAssignment} className="space-y-4 mt-4">
            <div className="space-y-2"><Label htmlFor="edit_title">Title *</Label><Input id="edit_title" value={editFormData.title} onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} required /></div>
            <div className="space-y-2">
              <Label htmlFor="edit_semester_id">Semester *</Label>
              <Select value={editFormData.semester_id} onValueChange={(value) => setEditFormData({ ...editFormData, semester_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                <SelectContent>{semesters.map((semester) => (<SelectItem key={semester.id} value={semester.id}>{semester.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="edit_description">Description</Label><Textarea id="edit_description" value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="edit_due_date">Due Date *</Label><Input id="edit_due_date" type="datetime-local" value={editFormData.due_date} onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })} required /></div>
              <div className="space-y-2"><Label htmlFor="edit_max_marks">Max Marks</Label><Input id="edit_max_marks" type="number" value={editFormData.max_marks} onChange={(e) => setEditFormData({ ...editFormData, max_marks: parseInt(e.target.value) })} /></div>
            </div>
            {editingAssignment?.file_url && !editFile && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Current: {editingAssignment.file_name || 'Attachment'}
              </div>
            )}
            <div className="space-y-2"><Label htmlFor="edit_file">Replace Attachment</Label><Input id="edit_file" type="file" onChange={(e) => setEditFile(e.target.files?.[0] || null)} /></div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditFile(null); }}>Cancel</Button>
              <Button type="submit" disabled={isUpdating}>{isUpdating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : 'Update'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Submissions Dialog */}
      <Dialog open={!!viewSubmissionsId} onOpenChange={(open) => { if (!open) setViewSubmissionsId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Student Submissions</DialogTitle></DialogHeader>
          {assignmentSubmissions.length > 0 ? (
            <div className="space-y-3 mt-4 max-h-96 overflow-y-auto">
              {assignmentSubmissions.map((sub) => (
                <div key={sub.id} className="p-4 rounded-lg bg-muted/50 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{(sub.student as any)?.profile?.full_name || 'Student'}</p>
                    <p className="text-sm text-muted-foreground">Roll: {(sub.student as any)?.roll_number} • Submitted: {format(new Date(sub.submitted_at), 'MMM d, yyyy h:mm a')}</p>
                    {sub.marks_obtained !== null && <p className="text-sm text-success">Marks: {sub.marks_obtained}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.file_url && (
                      <a href={sub.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" />Download</Button>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No submissions yet</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAssignmentId} onOpenChange={(open) => !open && setDeleteAssignmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Assignment?</AlertDialogTitle>
            <AlertDialogDescription>This will deactivate the assignment. Student submissions will be preserved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssignment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assignments Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : assignments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {assignments.map((assignment, index) => {
            const isPastDue = new Date(assignment.due_date) < new Date();
            const isSubmitted = submissions[assignment.id];
            return (
              <Card key={assignment.id} className="card-interactive animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2 rounded-lg bg-warning/10"><ClipboardList className="w-5 h-5 text-warning" /></div>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditAssignment(assignment)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleViewSubmissions(assignment.id)}>Submissions</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteAssignmentId(assignment.id)}><Trash2 className="w-4 h-4" /></Button>
                        </>
                      )}
                      <span className={`text-xs px-2 py-1 rounded font-medium ${isSubmitted ? 'bg-success/10 text-success' : isPastDue ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                        {isSubmitted ? 'Submitted' : isPastDue ? 'Past Due' : 'Pending'}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{assignment.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{assignment.description || 'No description'}</p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>Due: {format(new Date(assignment.due_date), 'MMM d, yyyy h:mm a')}</span></div>
                    <div className="flex items-center gap-2"><FileText className="w-4 h-4" /><span>Max Marks: {assignment.max_marks}</span></div>
                  </div>
                  {assignment.file_url && (
                    <a href={assignment.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-4 text-sm text-accent hover:underline">
                      <Download className="w-4 h-4" />{assignment.file_name || 'Download attachment'}
                    </a>
                  )}
                  {isStudent && !isSubmitted && !isPastDue && (
                    <div className="mt-4">
                      <Label htmlFor={`submit-${assignment.id}`} className="cursor-pointer">
                        <div className="flex items-center gap-2 p-3 rounded-lg border-2 border-dashed hover:border-accent transition-colors">
                          <Upload className="w-4 h-4" /><span className="text-sm">Submit your work</span>
                        </div>
                        <input id={`submit-${assignment.id}`} type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleSubmitAssignment(assignment.id, file); }} />
                      </Label>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No assignments found</p>
        </div>
      )}
    </div>
  );
}
