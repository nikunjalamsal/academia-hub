import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Plus, Search, Loader2, Edit, Users, Trash2, Upload } from 'lucide-react';
import { Student, Semester, Course } from '@/types/database';

export default function Students() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [batchCourseId, setBatchCourseId] = useState('');
  const [batchSemesterId, setBatchSemesterId] = useState('');
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '', full_name: '', phone: '', roll_number: '', course_id: '', current_semester_id: '',
    enrollment_year: new Date().getFullYear(), guardian_name: '', guardian_phone: '', address: '',
  });

  const [editFormData, setEditFormData] = useState({
    full_name: '', phone: '', roll_number: '', course_id: '', current_semester_id: '',
    enrollment_year: new Date().getFullYear(), guardian_name: '', guardian_phone: '', address: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      if (role === 'student') {
        // Students see their peers in the same semester
        const [selfRes, semestersRes, coursesRes] = await Promise.all([
          supabase.from('students').select('current_semester_id').eq('user_id', user?.id).maybeSingle(),
          supabase.from('semesters').select('*, course:courses(*)').order('semester_number'),
          supabase.from('courses').select('*').eq('is_active', true),
        ]);
        if (semestersRes.data) setSemesters(semestersRes.data as Semester[]);
        if (coursesRes.data) setCourses(coursesRes.data as Course[]);
        if (selfRes.data?.current_semester_id) {
          const { data: peersData } = await supabase
            .from('students')
            .select('*, profile:profiles(*), course:courses(*), current_semester:semesters(*)')
            .eq('current_semester_id', selfRes.data.current_semester_id)
            .eq('is_active', true)
            .order('roll_number');
          if (peersData) setStudents(peersData as Student[]);
        }
        setIsLoading(false);
        return;
      }
      const [studentsRes, semestersRes, coursesRes] = await Promise.all([
        supabase.from('students').select('*, profile:profiles(*), course:courses(*), current_semester:semesters(*)').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('semesters').select('*, course:courses(*)').order('semester_number'),
        supabase.from('courses').select('*').eq('is_active', true),
      ]);
      if (studentsRes.data) setStudents(studentsRes.data as Student[]);
      if (semestersRes.data) setSemesters(semestersRes.data as Semester[]);
      if (coursesRes.data) setCourses(coursesRes.data as Course[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally { setIsLoading(false); }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      // Check for deactivated student with same roll_number in same course
      const { data: deactivated } = await supabase.from('students').select('id').eq('roll_number', formData.roll_number).eq('course_id', formData.course_id).eq('is_active', false).maybeSingle();
      if (deactivated) {
        await supabase.from('students').update({ is_active: true, current_semester_id: formData.current_semester_id }).eq('id', deactivated.id);
        toast({ title: 'Student Reactivated', description: `A previously deactivated student with this roll number has been reactivated.` });
        setIsDialogOpen(false);
        setFormData({ email: '', full_name: '', phone: '', roll_number: '', course_id: '', current_semester_id: '', enrollment_year: new Date().getFullYear(), guardian_name: '', guardian_phone: '', address: '' });
        fetchData();
        setIsCreating(false);
        return;
      }

      const { data: existing } = await supabase.from('students').select('id').eq('roll_number', formData.roll_number).eq('course_id', formData.course_id).eq('is_active', true).maybeSingle();
      if (existing) {
        toast({ variant: 'destructive', title: 'Duplicate Roll Number', description: 'This roll number already exists in the selected course.' });
        setIsCreating(false);
        return;
      }

      const response = await supabase.functions.invoke('create-user', { body: { ...formData, role: 'student' } });
      if (response.error) throw response.error;
      if (response.data?.success) {
        toast({ title: 'Student Created', description: `${formData.full_name} has been added. Default password: Welcome@123` });
        setIsDialogOpen(false);
        setFormData({ email: '', full_name: '', phone: '', roll_number: '', course_id: '', current_semester_id: '', enrollment_year: new Date().getFullYear(), guardian_name: '', guardian_phone: '', address: '' });
        fetchData();
      } else {
        throw new Error(response.data?.error || 'Failed to create student');
      }
    } catch (error: any) {
      const msg = error.message?.includes('duplicate') || error.message?.includes('23505')
        ? 'This email or roll number is already in use. Please use unique values.' : error.message;
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally { setIsCreating(false); }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setEditFormData({
      full_name: (student.profile as any)?.full_name || '', phone: (student.profile as any)?.phone || '',
      roll_number: student.roll_number, course_id: student.course_id, current_semester_id: student.current_semester_id || '',
      enrollment_year: student.enrollment_year, guardian_name: student.guardian_name || '', guardian_phone: student.guardian_phone || '', address: student.address || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsUpdating(true);
    try {
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: editFormData.full_name, phone: editFormData.phone,
      }).eq('id', editingStudent.profile_id);
      if (profileError) throw profileError;

      const { error: studentError } = await supabase.from('students').update({
        roll_number: editFormData.roll_number, course_id: editFormData.course_id, current_semester_id: editFormData.current_semester_id,
        enrollment_year: editFormData.enrollment_year, guardian_name: editFormData.guardian_name, guardian_phone: editFormData.guardian_phone, address: editFormData.address,
      }).eq('id', editingStudent.id);
      if (studentError) throw studentError;

      toast({ title: 'Student Updated', description: 'Student details have been updated successfully.' });
      setIsEditDialogOpen(false);
      setEditingStudent(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setIsUpdating(false); }
  };

  const handleDeleteStudent = async () => {
    if (!deleteStudentId) return;
    try {
      const { error } = await supabase.from('students').update({ is_active: false }).eq('id', deleteStudentId);
      if (error) throw error;
      toast({ title: 'Student Deactivated', description: 'The student has been deactivated.' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setDeleteStudentId(null); }
  };

  const handlePhotoUpload = async (studentId: string, profileId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatars/students/${studentId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('academic-files').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('academic-files').getPublicUrl(fileName);
      const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profileId);
      if (error) throw error;
      toast({ title: 'Photo Updated', description: 'Profile photo has been updated.' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleBatchAssignment = async () => {
    if (selectedStudents.length === 0) { toast({ variant: 'destructive', title: 'No Students Selected', description: 'Please select at least one student.' }); return; }
    if (!batchSemesterId) { toast({ variant: 'destructive', title: 'No Semester Selected', description: 'Please select a semester to assign.' }); return; }
    setIsBatchUpdating(true);
    try {
      const selectedSem = semesters.find(s => s.id === batchSemesterId);
      const courseId = selectedSem?.course_id || batchCourseId;
      const { error } = await supabase.from('students').update({ current_semester_id: batchSemesterId, course_id: courseId }).in('id', selectedStudents);
      if (error) throw error;
      toast({ title: 'Students Updated', description: `${selectedStudents.length} student(s) have been assigned to the selected semester.` });
      setIsBatchDialogOpen(false);
      setSelectedStudents([]);
      setBatchCourseId('');
      setBatchSemesterId('');
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setIsBatchUpdating(false); }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]);
  };

  const toggleAllStudents = () => {
    if (selectedStudents.length === filteredStudents.length) { setSelectedStudents([]); } else { setSelectedStudents(filteredStudents.map(s => s.id)); }
  };

  const filteredSemesters = selectedCourse === 'all' ? semesters : semesters.filter(s => s.course_id === selectedCourse);

  const filteredStudents = students.filter(student => {
    const matchesSearch = (student.profile as any)?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.profile as any)?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || student.course_id === selectedCourse;
    const matchesSemester = selectedSemester === 'all' || student.current_semester_id === selectedSemester;
    return matchesSearch && matchesCourse && matchesSemester;
  });

  const batchFilteredSemesters = batchCourseId ? semesters.filter(s => s.course_id === batchCourseId) : semesters;
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const canManage = isAdmin;

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-student" />Students
          </h1>
          <p className="text-muted-foreground mt-1">{isAdmin ? 'Manage student records' : 'View students in your classes'}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={selectedStudents.length === 0}>
                  <Users className="w-4 h-4" />Batch Assign ({selectedStudents.length})
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Batch Assign Students to Semester</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">Assign {selectedStudents.length} selected student(s) to a course and semester.</p>
                  <div className="space-y-2">
                    <Label>Select Course</Label>
                    <Select value={batchCourseId} onValueChange={(value) => { setBatchCourseId(value); setBatchSemesterId(''); }}>
                      <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                      <SelectContent>{courses.map((course) => (<SelectItem key={course.id} value={course.id}>{course.name} ({course.code})</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Semester</Label>
                    <Select value={batchSemesterId} onValueChange={setBatchSemesterId}>
                      <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                      <SelectContent>{batchFilteredSemesters.map((semester) => (<SelectItem key={semester.id} value={semester.id}>{semester.name} {semester.course && `(${(semester.course as any).code})`}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setIsBatchDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleBatchAssignment} disabled={isBatchUpdating || !batchSemesterId}>
                      {isBatchUpdating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Assigning...</> : 'Assign Students'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" />Add Student</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add New Student</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateStudent} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="full_name">Full Name *</Label><Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required /></div>
                    <div className="space-y-2"><Label htmlFor="email">Email *</Label><Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required /></div>
                    <div className="space-y-2"><Label htmlFor="roll_number">Roll Number *</Label><Input id="roll_number" value={formData.roll_number} onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })} required /></div>
                    <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                    <div className="space-y-2">
                      <Label htmlFor="course_id">Course *</Label>
                      <Select value={formData.course_id} onValueChange={(value) => setFormData({ ...formData, course_id: value, current_semester_id: '' })}>
                        <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                        <SelectContent>{courses.map((course) => (<SelectItem key={course.id} value={course.id}>{course.name} ({course.code})</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="current_semester_id">Current Semester *</Label>
                      <Select value={formData.current_semester_id} onValueChange={(value) => setFormData({ ...formData, current_semester_id: value })}>
                        <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                        <SelectContent>{semesters.filter(s => !formData.course_id || s.course_id === formData.course_id).map((semester) => (<SelectItem key={semester.id} value={semester.id}>{semester.name}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label htmlFor="enrollment_year">Enrollment Year *</Label><Input id="enrollment_year" type="number" value={formData.enrollment_year} onChange={(e) => setFormData({ ...formData, enrollment_year: parseInt(e.target.value) })} required /></div>
                    <div className="space-y-2"><Label htmlFor="guardian_name">Guardian Name</Label><Input id="guardian_name" value={formData.guardian_name} onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })} /></div>
                    <div className="space-y-2"><Label htmlFor="guardian_phone">Guardian Phone</Label><Input id="guardian_phone" value={formData.guardian_phone} onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })} /></div>
                    <div className="space-y-2 col-span-2"><Label htmlFor="address">Address</Label><Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
                  </div>
                  <div className="bg-muted p-3 rounded-lg text-sm">
                    <p className="font-medium">Note:</p>
                    <p className="text-muted-foreground">Default password will be <code className="bg-background px-1 rounded">Welcome@123</code>.</p>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Student'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateStudent} className="space-y-4 mt-4">
            {editingStudent && (
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={(editingStudent.profile as any)?.avatar_url} />
                  <AvatarFallback>{(editingStudent.profile as any)?.full_name?.charAt(0) || 'S'}</AvatarFallback>
                </Avatar>
                <Label htmlFor="student_photo" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-muted transition-colors text-sm">
                    <Upload className="w-4 h-4" /> Upload Photo
                  </div>
                  <input id="student_photo" type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && editingStudent) handlePhotoUpload(editingStudent.id, editingStudent.profile_id, file);
                  }} />
                </Label>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="edit_full_name">Full Name *</Label><Input id="edit_full_name" value={editFormData.full_name} onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })} required /></div>
              <div className="space-y-2"><Label htmlFor="edit_phone">Phone</Label><Input id="edit_phone" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="edit_roll_number">Roll Number *</Label><Input id="edit_roll_number" value={editFormData.roll_number} onChange={(e) => setEditFormData({ ...editFormData, roll_number: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label htmlFor="edit_course_id">Course *</Label>
                <Select value={editFormData.course_id} onValueChange={(value) => setEditFormData({ ...editFormData, course_id: value, current_semester_id: '' })}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>{courses.map((course) => (<SelectItem key={course.id} value={course.id}>{course.name} ({course.code})</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_current_semester_id">Current Semester *</Label>
                <Select value={editFormData.current_semester_id} onValueChange={(value) => setEditFormData({ ...editFormData, current_semester_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                  <SelectContent>{semesters.filter(s => !editFormData.course_id || s.course_id === editFormData.course_id).map((semester) => (<SelectItem key={semester.id} value={semester.id}>{semester.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label htmlFor="edit_enrollment_year">Enrollment Year *</Label><Input id="edit_enrollment_year" type="number" value={editFormData.enrollment_year} onChange={(e) => setEditFormData({ ...editFormData, enrollment_year: parseInt(e.target.value) })} required /></div>
              <div className="space-y-2"><Label htmlFor="edit_guardian_name">Guardian Name</Label><Input id="edit_guardian_name" value={editFormData.guardian_name} onChange={(e) => setEditFormData({ ...editFormData, guardian_name: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="edit_guardian_phone">Guardian Phone</Label><Input id="edit_guardian_phone" value={editFormData.guardian_phone} onChange={(e) => setEditFormData({ ...editFormData, guardian_phone: e.target.value })} /></div>
              <div className="space-y-2 col-span-2"><Label htmlFor="edit_address">Address</Label><Input id="edit_address" value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : 'Update Student'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteStudentId} onOpenChange={(open) => !open && setDeleteStudentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Student?</AlertDialogTitle>
            <AlertDialogDescription>This will deactivate the student. They will no longer be able to access the system. You can reactivate by re-adding them with the same roll number and course.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStudent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filters */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name, roll number, or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={selectedCourse} onValueChange={(value) => { setSelectedCourse(value); setSelectedSemester('all'); }}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filter by course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((course) => (<SelectItem key={course.id} value={course.id}>{course.name} ({course.code})</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filter by semester" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                {filteredSemesters.map((semester) => (<SelectItem key={semester.id} value={semester.id}>{semester.name} {(semester as any).course ? `(${((semester as any).course as any).code})` : ''}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filteredStudents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && (
                    <TableHead className="w-12">
                      <Checkbox checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0} onCheckedChange={toggleAllStudents} />
                    </TableHead>
                  )}
                  <TableHead>Photo</TableHead>
                  <TableHead>Roll No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Semester</TableHead>
                  {canManage && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id} className="table-row-hover">
                    {canManage && (
                      <TableCell>
                        <Checkbox checked={selectedStudents.includes(student.id)} onCheckedChange={() => toggleStudentSelection(student.id)} />
                      </TableCell>
                    )}
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={(student.profile as any)?.avatar_url} />
                        <AvatarFallback className="text-xs">{(student.profile as any)?.full_name?.charAt(0) || 'S'}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{student.roll_number}</TableCell>
                    <TableCell>{(student.profile as any)?.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{(student.profile as any)?.email}</TableCell>
                    <TableCell>{(student.course as any)?.code}</TableCell>
                    <TableCell>{(student.current_semester as any)?.name}</TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditStudent(student)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteStudentId(student.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No students found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
