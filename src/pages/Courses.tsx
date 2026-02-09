import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Plus, Loader2, Edit, Trash2 } from 'lucide-react';
import { Course, Semester, Subject } from '@/types/database';

export default function Courses() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
  const [isEditCourseDialogOpen, setIsEditCourseDialogOpen] = useState(false);
  const [isEditSubjectDialogOpen, setIsEditSubjectDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);
  const [deleteSubjectId, setDeleteSubjectId] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [courseForm, setCourseForm] = useState({ name: '', code: '', description: '', duration_years: 3, total_semesters: 6 });
  const [editCourseForm, setEditCourseForm] = useState({ name: '', code: '', description: '', duration_years: 3, total_semesters: 6 });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', credits: 3, semester_id: '' });
  const [editSubjectForm, setEditSubjectForm] = useState({ name: '', code: '', credits: 3, semester_id: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [coursesRes, semestersRes, subjectsRes] = await Promise.all([
        supabase.from('courses').select('*').eq('is_active', true).order('created_at'),
        supabase.from('semesters').select('*').order('semester_number'),
        supabase.from('subjects').select('*, semester:semesters(*)').eq('is_active', true).order('name'),
      ]);
      if (coursesRes.data) {
        setCourses(coursesRes.data as Course[]);
        if (coursesRes.data.length > 0 && !selectedCourse) setSelectedCourse(coursesRes.data[0] as Course);
      }
      if (semestersRes.data) setSemesters(semestersRes.data as Semester[]);
      if (subjectsRes.data) setSubjects(subjectsRes.data as Subject[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally { setIsLoading(false); }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      // Check for deactivated course with same code
      const { data: deactivated } = await supabase.from('courses').select('id').eq('code', courseForm.code).eq('is_active', false).maybeSingle();
      if (deactivated) {
        await supabase.from('courses').update({ is_active: true, name: courseForm.name, description: courseForm.description }).eq('id', deactivated.id);
        toast({ title: 'Course Reactivated', description: `A previously deactivated course with code ${courseForm.code} has been reactivated.` });
        setIsCourseDialogOpen(false);
        setCourseForm({ name: '', code: '', description: '', duration_years: 3, total_semesters: 6 });
        fetchData();
        setIsCreating(false);
        return;
      }

      const { data: courseData, error: courseError } = await supabase.from('courses').insert({
        name: courseForm.name, code: courseForm.code, description: courseForm.description,
        duration_years: courseForm.duration_years, total_semesters: courseForm.total_semesters,
      }).select().single();
      if (courseError) throw courseError;

      const semesterInserts = [];
      for (let i = 1; i <= courseForm.total_semesters; i++) {
        semesterInserts.push({ course_id: courseData.id, semester_number: i, name: `Semester ${i}` });
      }
      const { error: semesterError } = await supabase.from('semesters').insert(semesterInserts);
      if (semesterError) throw semesterError;

      toast({ title: 'Course Created', description: `${courseForm.name} with ${courseForm.total_semesters} semesters has been created.` });
      setIsCourseDialogOpen(false);
      setCourseForm({ name: '', code: '', description: '', duration_years: 3, total_semesters: 6 });
      fetchData();
    } catch (error: any) {
      const msg = error.message?.includes('duplicate') || error.message?.includes('23505')
        ? 'A course with this code already exists.' : error.message;
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally { setIsCreating(false); }
  };

  const handleEditCourse = () => {
    if (!selectedCourse) return;
    setEditCourseForm({
      name: selectedCourse.name, code: selectedCourse.code, description: selectedCourse.description || '',
      duration_years: selectedCourse.duration_years, total_semesters: selectedCourse.total_semesters,
    });
    setIsEditCourseDialogOpen(true);
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('courses').update({
        name: editCourseForm.name, code: editCourseForm.code, description: editCourseForm.description,
        duration_years: editCourseForm.duration_years,
      }).eq('id', selectedCourse.id);
      if (error) throw error;
      toast({ title: 'Course Updated', description: 'Course details have been updated.' });
      setIsEditCourseDialogOpen(false);
      setSelectedCourse({ ...selectedCourse, ...editCourseForm });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setIsUpdating(false); }
  };

  const handleDeleteCourse = async () => {
    if (!deleteCourseId) return;
    try {
      const { error } = await supabase.from('courses').update({ is_active: false }).eq('id', deleteCourseId);
      if (error) throw error;
      toast({ title: 'Course Deactivated', description: 'The course has been deactivated.' });
      if (selectedCourse?.id === deleteCourseId) setSelectedCourse(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setDeleteCourseId(null); }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      // Check for deactivated subject with same code
      const { data: deactivated } = await supabase.from('subjects').select('id').eq('code', subjectForm.code).eq('is_active', false).maybeSingle();
      if (deactivated) {
        await supabase.from('subjects').update({ is_active: true, name: subjectForm.name, credits: subjectForm.credits, semester_id: subjectForm.semester_id }).eq('id', deactivated.id);
        toast({ title: 'Subject Reactivated', description: `A previously deactivated subject with code ${subjectForm.code} has been reactivated.` });
        setIsSubjectDialogOpen(false);
        setSubjectForm({ name: '', code: '', credits: 3, semester_id: '' });
        fetchData();
        setIsCreating(false);
        return;
      }

      const { error } = await supabase.from('subjects').insert({
        name: subjectForm.name, code: subjectForm.code, credits: subjectForm.credits, semester_id: subjectForm.semester_id,
      });
      if (error) throw error;
      toast({ title: 'Subject Created', description: 'The subject has been added successfully.' });
      setIsSubjectDialogOpen(false);
      setSubjectForm({ name: '', code: '', credits: 3, semester_id: '' });
      fetchData();
    } catch (error: any) {
      const msg = error.message?.includes('duplicate') || error.message?.includes('23505')
        ? 'A subject with this code already exists.' : error.message;
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally { setIsCreating(false); }
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setEditSubjectForm({ name: subject.name, code: subject.code, credits: subject.credits, semester_id: subject.semester_id });
    setIsEditSubjectDialogOpen(true);
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('subjects').update({
        name: editSubjectForm.name, code: editSubjectForm.code, credits: editSubjectForm.credits, semester_id: editSubjectForm.semester_id,
      }).eq('id', editingSubject.id);
      if (error) throw error;
      toast({ title: 'Subject Updated', description: 'Subject details have been updated.' });
      setIsEditSubjectDialogOpen(false);
      setEditingSubject(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setIsUpdating(false); }
  };

  const handleDeleteSubject = async () => {
    if (!deleteSubjectId) return;
    try {
      const { error } = await supabase.from('subjects').update({ is_active: false }).eq('id', deleteSubjectId);
      if (error) throw error;
      toast({ title: 'Subject Deactivated', description: 'The subject has been deactivated.' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setDeleteSubjectId(null); }
  };

  const filteredSemesters = semesters.filter(s => s.course_id === selectedCourse?.id);
  const filteredSubjects = subjects.filter(s => filteredSemesters.some(sem => sem.id === s.semester_id));

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
        <div className="flex gap-3">
          <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Plus className="w-4 h-4" />Add Course</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Course</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateCourse} className="space-y-4 mt-4">
                <div className="space-y-2"><Label htmlFor="course_name">Course Name *</Label><Input id="course_name" value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="e.g., Bachelor of Computer Applications" required /></div>
                <div className="space-y-2"><Label htmlFor="course_code">Course Code *</Label><Input id="course_code" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="e.g., BCA" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="duration_years">Duration (Years) *</Label><Input id="duration_years" type="number" value={courseForm.duration_years} onChange={(e) => setCourseForm({ ...courseForm, duration_years: parseInt(e.target.value) })} min={1} max={6} required /></div>
                  <div className="space-y-2"><Label htmlFor="total_semesters">Total Semesters *</Label><Input id="total_semesters" type="number" value={courseForm.total_semesters} onChange={(e) => setCourseForm({ ...courseForm, total_semesters: parseInt(e.target.value) })} min={1} max={12} required /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} rows={3} /></div>
                <div className="bg-muted p-3 rounded-lg text-sm"><p className="text-muted-foreground">This will automatically create {courseForm.total_semesters} semesters for this course.</p></div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsCourseDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isCreating}>{isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Course'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Add Subject</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Subject</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateSubject} className="space-y-4 mt-4">
                <div className="space-y-2"><Label htmlFor="name">Subject Name *</Label><Input id="name" value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label htmlFor="code">Subject Code *</Label><Input id="code" value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })} placeholder="e.g., CS101" required /></div>
                <div className="space-y-2">
                  <Label htmlFor="semester_id">Semester *</Label>
                  <Select value={subjectForm.semester_id} onValueChange={(value) => setSubjectForm({ ...subjectForm, semester_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                    <SelectContent>{filteredSemesters.map((semester) => (<SelectItem key={semester.id} value={semester.id}>{semester.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label htmlFor="credits">Credits</Label><Input id="credits" type="number" value={subjectForm.credits} onChange={(e) => setSubjectForm({ ...subjectForm, credits: parseInt(e.target.value) })} min={1} max={10} /></div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsSubjectDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isCreating}>{isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Subject'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Course Dialog */}
      <Dialog open={isEditCourseDialogOpen} onOpenChange={setIsEditCourseDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Course</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateCourse} className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Course Name *</Label><Input value={editCourseForm.name} onChange={(e) => setEditCourseForm({ ...editCourseForm, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Course Code *</Label><Input value={editCourseForm.code} onChange={(e) => setEditCourseForm({ ...editCourseForm, code: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Duration (Years)</Label><Input type="number" value={editCourseForm.duration_years} onChange={(e) => setEditCourseForm({ ...editCourseForm, duration_years: parseInt(e.target.value) })} min={1} max={6} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={editCourseForm.description} onChange={(e) => setEditCourseForm({ ...editCourseForm, description: e.target.value })} rows={3} /></div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsEditCourseDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isUpdating}>{isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Course'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Subject Dialog */}
      <Dialog open={isEditSubjectDialogOpen} onOpenChange={setIsEditSubjectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Subject</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateSubject} className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Subject Name *</Label><Input value={editSubjectForm.name} onChange={(e) => setEditSubjectForm({ ...editSubjectForm, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Subject Code *</Label><Input value={editSubjectForm.code} onChange={(e) => setEditSubjectForm({ ...editSubjectForm, code: e.target.value })} required /></div>
            <div className="space-y-2">
              <Label>Semester *</Label>
              <Select value={editSubjectForm.semester_id} onValueChange={(value) => setEditSubjectForm({ ...editSubjectForm, semester_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                <SelectContent>{filteredSemesters.map((semester) => (<SelectItem key={semester.id} value={semester.id}>{semester.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Credits</Label><Input type="number" value={editSubjectForm.credits} onChange={(e) => setEditSubjectForm({ ...editSubjectForm, credits: parseInt(e.target.value) })} min={1} max={10} /></div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsEditSubjectDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isUpdating}>{isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Subject'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Course Confirmation */}
      <AlertDialog open={!!deleteCourseId} onOpenChange={(open) => !open && setDeleteCourseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Course?</AlertDialogTitle>
            <AlertDialogDescription>This will deactivate the course. Students and teachers assigned to this course will still retain their records. You can reactivate by adding a course with the same code.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCourse} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Subject Confirmation */}
      <AlertDialog open={!!deleteSubjectId} onOpenChange={(open) => !open && setDeleteSubjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Subject?</AlertDialogTitle>
            <AlertDialogDescription>This will deactivate the subject. Existing attendance and assignment records will be preserved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSubject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle>Courses</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {courses.length > 0 ? courses.map((course) => (
                <div key={course.id} onClick={() => setSelectedCourse(course)}
                  className={`p-4 rounded-lg cursor-pointer transition-colors relative group ${selectedCourse?.id === course.id ? 'bg-primary/10 border-2 border-primary' : 'bg-muted hover:bg-muted/80'}`}>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedCourse(course); handleEditCourse(); }}><Edit className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteCourseId(course.id); }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <h3 className="font-semibold">{course.code}</h3>
                  <p className="text-sm text-muted-foreground">{course.name}</p>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{course.duration_years} years</span>
                    <span>{course.total_semesters} semesters</span>
                  </div>
                </div>
              )) : (
                <p className="text-center text-muted-foreground py-8">No courses found. Click "Add Course" to create one.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>{selectedCourse ? `${selectedCourse.name} - Semesters & Subjects` : 'Select a Course'}</CardTitle></CardHeader>
            <CardContent>
              {selectedCourse ? (
                <div className="space-y-6">
                  {filteredSemesters.length > 0 ? filteredSemesters.map((semester) => {
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
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {semSubjects.map((subject) => (
                                <TableRow key={subject.id}>
                                  <TableCell className="font-mono text-sm">{subject.code}</TableCell>
                                  <TableCell>{subject.name}</TableCell>
                                  <TableCell>{subject.credits}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditSubject(subject)}><Edit className="w-3 h-3" /></Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteSubjectId(subject.id)}><Trash2 className="w-3 h-3" /></Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">No subjects added yet</p>
                        )}
                      </div>
                    );
                  }) : (
                    <p className="text-center text-muted-foreground py-8">No semesters found for this course.</p>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Select a course to view its semesters and subjects.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
