import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Plus, Loader2 } from 'lucide-react';
import { Course, Semester, Subject } from '@/types/database';

export default function Courses() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    credits: 3,
    semester_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [coursesRes, semestersRes, subjectsRes] = await Promise.all([
        supabase.from('courses').select('*').eq('is_active', true),
        supabase.from('semesters').select('*').order('semester_number'),
        supabase.from('subjects').select('*, semester:semesters(*)').order('name'),
      ]);

      if (coursesRes.data) {
        setCourses(coursesRes.data as Course[]);
        if (coursesRes.data.length > 0) setSelectedCourse(coursesRes.data[0] as Course);
      }
      if (semestersRes.data) setSemesters(semestersRes.data as Semester[]);
      if (subjectsRes.data) setSubjects(subjectsRes.data as Subject[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { error } = await supabase.from('subjects').insert({
        name: subjectForm.name,
        code: subjectForm.code,
        credits: subjectForm.credits,
        semester_id: subjectForm.semester_id,
      });

      if (error) throw error;

      toast({
        title: 'Subject Created',
        description: 'The subject has been added successfully.',
      });
      
      setIsSubjectDialogOpen(false);
      setSubjectForm({ name: '', code: '', credits: 3, semester_id: '' });
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

  const filteredSemesters = semesters.filter(s => s.course_id === selectedCourse?.id);
  const filteredSubjects = subjects.filter(s => 
    filteredSemesters.some(sem => sem.id === s.semester_id)
  );

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            Courses & Subjects
          </h1>
          <p className="text-muted-foreground mt-1">Manage courses, semesters, and subjects</p>
        </div>
        <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Subject</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubject} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name *</Label>
                <Input
                  id="name"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Subject Code *</Label>
                <Input
                  id="code"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  placeholder="e.g., CS101"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semester_id">Semester *</Label>
                <select
                  id="semester_id"
                  value={subjectForm.semester_id}
                  onChange={(e) => setSubjectForm({ ...subjectForm, semester_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="">Select semester</option>
                  {filteredSemesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="credits">Credits</Label>
                <Input
                  id="credits"
                  type="number"
                  value={subjectForm.credits}
                  onChange={(e) => setSubjectForm({ ...subjectForm, credits: parseInt(e.target.value) })}
                  min={1}
                  max={10}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsSubjectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Subject'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Course Info */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Course Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCourse && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/10">
                    <h3 className="text-lg font-semibold">{selectedCourse.code}</h3>
                    <p className="text-sm text-muted-foreground">{selectedCourse.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="font-medium">{selectedCourse.duration_years} years</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Semesters</p>
                      <p className="font-medium">{selectedCourse.total_semesters}</p>
                    </div>
                  </div>
                  {selectedCourse.description && (
                    <div>
                      <p className="text-muted-foreground text-sm">Description</p>
                      <p className="text-sm">{selectedCourse.description}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Semesters & Subjects */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Semesters & Subjects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {filteredSemesters.map((semester) => {
                  const semSubjects = subjects.filter(s => s.semester_id === semester.id);
                  return (
                    <div key={semester.id} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-3">{semester.name}</h4>
                      {semSubjects.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Code</TableHead>
                              <TableHead>Subject</TableHead>
                              <TableHead>Credits</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {semSubjects.map((subject) => (
                              <TableRow key={subject.id}>
                                <TableCell className="font-mono text-sm">{subject.code}</TableCell>
                                <TableCell>{subject.name}</TableCell>
                                <TableCell>{subject.credits}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No subjects added yet
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
