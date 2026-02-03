import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Plus, Loader2, Calendar, FileText, Upload, Download } from 'lucide-react';
import { Assignment, Semester, Teacher, Student } from '@/types/database';
import { format } from 'date-fns';

export default function Assignments() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    semester_id: '',
    due_date: '',
    max_marks: 100,
  });

  useEffect(() => {
    fetchData();
  }, [user, role]);

  const fetchData = async () => {
    try {
      if (role === 'teacher' && user) {
        // Get teacher record
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (teacherData) {
          setTeacher(teacherData as Teacher);
          
          // Get teacher's semester assignments
          const { data: assignmentsData } = await supabase
            .from('teacher_semester_assignments')
            .select('semester_id')
            .eq('teacher_id', teacherData.id);
          
          const semesterIds = assignmentsData?.map(a => a.semester_id) || [];
          
          // Get assignments
          const { data } = await supabase
            .from('assignments')
            .select('*, semester:semesters(*)')
            .eq('teacher_id', teacherData.id)
            .order('due_date', { ascending: false });
          
          if (data) setAssignments(data as Assignment[]);

          // Get semesters for this teacher
          const { data: semData } = await supabase
            .from('semesters')
            .select('*')
            .in('id', semesterIds);
          
          if (semData) setSemesters(semData as Semester[]);
        }
      } else if (role === 'student' && user) {
        // Get student record
        const { data: studentData } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (studentData) {
          setStudent(studentData as Student);
          
          // Get assignments for student's semester
          const { data } = await supabase
            .from('assignments')
            .select('*, semester:semesters(*), teacher:teachers(*, profile:profiles(*))')
            .eq('semester_id', studentData.current_semester_id)
            .eq('is_active', true)
            .order('due_date', { ascending: true });
          
          if (data) setAssignments(data as Assignment[]);

          // Get submissions
          const { data: subData } = await supabase
            .from('assignment_submissions')
            .select('assignment_id')
            .eq('student_id', studentData.id);
          
          const subMap: Record<string, boolean> = {};
          subData?.forEach(s => { subMap[s.assignment_id] = true; });
          setSubmissions(subMap);
        }
      } else if (role === 'admin') {
        // Admin sees all
        const [assignmentsRes, semestersRes] = await Promise.all([
          supabase.from('assignments').select('*, semester:semesters(*), teacher:teachers(*, profile:profiles(*))').order('due_date', { ascending: false }),
          supabase.from('semesters').select('*').order('semester_number'),
        ]);
        
        if (assignmentsRes.data) setAssignments(assignmentsRes.data as Assignment[]);
        if (semestersRes.data) setSemesters(semestersRes.data as Semester[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!teacher) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `assignments/${teacher.id}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('academic-files')
      .upload(fileName, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('academic-files')
      .getPublicUrl(fileName);
    
    return { url: publicUrl, name: file.name };
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;
    
    setIsCreating(true);

    try {
      let fileData = null;
      if (selectedFile) {
        setUploadingFile(true);
        fileData = await handleFileUpload(selectedFile);
        setUploadingFile(false);
      }

      const { error } = await supabase.from('assignments').insert({
        teacher_id: teacher.id,
        semester_id: formData.semester_id,
        title: formData.title,
        description: formData.description,
        due_date: formData.due_date,
        max_marks: formData.max_marks,
        file_url: fileData?.url,
        file_name: fileData?.name,
      });

      if (error) throw error;

      toast({
        title: 'Assignment Created',
        description: 'The assignment has been created successfully.',
      });
      
      setIsDialogOpen(false);
      setFormData({ title: '', description: '', semester_id: '', due_date: '', max_marks: 100 });
      setSelectedFile(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitAssignment = async (assignmentId: string, file: File) => {
    if (!student) return;
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `submissions/${student.id}/${assignmentId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('academic-files')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('academic-files')
        .getPublicUrl(fileName);
      
      const { error } = await supabase.from('assignment_submissions').insert({
        assignment_id: assignmentId,
        student_id: student.id,
        file_url: publicUrl,
        file_name: file.name,
      });
      
      if (error) throw error;
      
      toast({
        title: 'Assignment Submitted',
        description: 'Your assignment has been submitted successfully.',
      });
      
      setSubmissions({ ...submissions, [assignmentId]: true });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';

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
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Assignment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateAssignment} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="semester_id">Semester *</Label>
                  <Select
                    value={formData.semester_id}
                    onValueChange={(value) => setFormData({ ...formData, semester_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {semesters.map((semester) => (
                        <SelectItem key={semester.id} value={semester.id}>
                          {semester.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due Date *</Label>
                    <Input
                      id="due_date"
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_marks">Max Marks</Label>
                    <Input
                      id="max_marks"
                      type="number"
                      value={formData.max_marks}
                      onChange={(e) => setFormData({ ...formData, max_marks: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file">Attachment (Optional)</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {uploadingFile ? 'Uploading...' : 'Creating...'}
                      </>
                    ) : (
                      'Create'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Assignments Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : assignments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {assignments.map((assignment, index) => {
            const isPastDue = new Date(assignment.due_date) < new Date();
            const isSubmitted = submissions[assignment.id];
            
            return (
              <Card key={assignment.id} className="card-interactive animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2 rounded-lg bg-warning/10">
                      <ClipboardList className="w-5 h-5 text-warning" />
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      isSubmitted ? 'bg-success/10 text-success' :
                      isPastDue ? 'bg-destructive/10 text-destructive' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {isSubmitted ? 'Submitted' : isPastDue ? 'Past Due' : 'Pending'}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{assignment.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {assignment.description || 'No description'}
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {format(new Date(assignment.due_date), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Max Marks: {assignment.max_marks}</span>
                    </div>
                  </div>
                  {assignment.file_url && (
                    <a
                      href={assignment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-4 text-sm text-accent hover:underline"
                    >
                      <Download className="w-4 h-4" />
                      {assignment.file_name || 'Download attachment'}
                    </a>
                  )}
                  {isStudent && !isSubmitted && !isPastDue && (
                    <div className="mt-4">
                      <Label htmlFor={`submit-${assignment.id}`} className="cursor-pointer">
                        <div className="flex items-center gap-2 p-3 rounded-lg border-2 border-dashed hover:border-accent transition-colors">
                          <Upload className="w-4 h-4" />
                          <span className="text-sm">Submit your work</span>
                        </div>
                        <input
                          id={`submit-${assignment.id}`}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSubmitAssignment(assignment.id, file);
                          }}
                        />
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
