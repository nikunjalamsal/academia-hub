import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Search, Loader2, Edit, Trash2, Upload } from 'lucide-react';
import { Teacher, Semester, Course, Subject } from '@/types/database';

export default function Teachers() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  const [formData, setFormData] = useState({
    email: '', full_name: '', phone: '', employee_id: '', department: '', designation: '', qualification: '',
  });
  const [selectedSemesters, setSelectedSemesters] = useState<{ semester_id: string; subject_name: string; subject_id?: string }[]>([]);

  const [editFormData, setEditFormData] = useState({
    full_name: '', phone: '', employee_id: '', department: '', designation: '', qualification: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [teachersRes, semestersRes, coursesRes, subjectsRes] = await Promise.all([
        supabase.from('teachers').select('*, profile:profiles(*)').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('semesters').select('*, course:courses(*)').order('semester_number'),
        supabase.from('courses').select('*').eq('is_active', true),
        supabase.from('subjects').select('*').eq('is_active', true).order('name'),
      ]);
      if (teachersRes.data) setTeachers(teachersRes.data as Teacher[]);
      if (semestersRes.data) setSemesters(semestersRes.data as Semester[]);
      if (coursesRes.data) setCourses(coursesRes.data as Course[]);
      if (subjectsRes.data) setSubjects(subjectsRes.data as Subject[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally { setIsLoading(false); }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      // Check for duplicate employee_id
      const { data: existing } = await supabase.from('teachers').select('id').eq('employee_id', formData.employee_id).maybeSingle();
      if (existing) {
        toast({ variant: 'destructive', title: 'Duplicate Employee ID', description: 'A teacher with this Employee ID already exists.' });
        setIsCreating(false);
        return;
      }

      const response = await supabase.functions.invoke('create-user', {
        body: { ...formData, role: 'teacher', semester_assignments: selectedSemesters.filter(s => s.subject_name || s.subject_id) },
      });
      if (response.error) throw response.error;
      if (response.data?.success) {
        toast({ title: 'Teacher Created', description: `${formData.full_name} has been added. Default password: Welcome@123` });
        setIsDialogOpen(false);
        setFormData({ email: '', full_name: '', phone: '', employee_id: '', department: '', designation: '', qualification: '' });
        setSelectedSemesters([]);
        setSelectedCourse('');
        fetchData();
      } else {
        throw new Error(response.data?.error || 'Failed to create teacher');
      }
    } catch (error: any) {
      const msg = error.message?.includes('duplicate') || error.message?.includes('23505')
        ? 'This email or Employee ID is already in use. Please use unique values.'
        : error.message;
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally { setIsCreating(false); }
  };

  const handleEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setEditFormData({
      full_name: (teacher.profile as any)?.full_name || '',
      phone: (teacher.profile as any)?.phone || '',
      employee_id: teacher.employee_id,
      department: teacher.department || '',
      designation: teacher.designation || '',
      qualification: teacher.qualification || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    setIsUpdating(true);
    try {
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: editFormData.full_name, phone: editFormData.phone,
      }).eq('id', editingTeacher.profile_id);
      if (profileError) throw profileError;

      const { error: teacherError } = await supabase.from('teachers').update({
        employee_id: editFormData.employee_id, department: editFormData.department,
        designation: editFormData.designation, qualification: editFormData.qualification,
      }).eq('id', editingTeacher.id);
      if (teacherError) throw teacherError;

      toast({ title: 'Teacher Updated', description: 'Teacher details have been updated successfully.' });
      setIsEditDialogOpen(false);
      setEditingTeacher(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setIsUpdating(false); }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    try {
      const { error } = await supabase.from('teachers').update({ is_active: false }).eq('id', teacherId);
      if (error) throw error;
      toast({ title: 'Teacher Deactivated', description: 'The teacher has been deactivated.' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handlePhotoUpload = async (teacherId: string, profileId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatars/teachers/${teacherId}/${Date.now()}.${fileExt}`;
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

  const toggleSemester = (semesterId: string) => {
    const exists = selectedSemesters.find(s => s.semester_id === semesterId);
    if (exists) {
      setSelectedSemesters(selectedSemesters.filter(s => s.semester_id !== semesterId));
    } else {
      setSelectedSemesters([...selectedSemesters, { semester_id: semesterId, subject_name: '', subject_id: '' }]);
    }
  };

  const updateSubjectSelection = (semesterId: string, subjectId: string, subjectName: string) => {
    setSelectedSemesters(selectedSemesters.map(s =>
      s.semester_id === semesterId ? { ...s, subject_id: subjectId, subject_name: subjectName } : s
    ));
  };

  const filteredSemesters = selectedCourse ? semesters.filter(s => s.course_id === selectedCourse) : semesters;
  const getSubjectsForSemester = (semesterId: string) => subjects.filter(s => s.semester_id === semesterId);

  const filteredTeachers = teachers.filter(teacher =>
    (teacher.profile as any)?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (teacher.profile as any)?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAdmin = role === 'admin';

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-teacher" />
            Teachers
          </h1>
          <p className="text-muted-foreground mt-1">Manage faculty members</p>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Add Teacher</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add New Teacher</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateTeacher} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="full_name">Full Name *</Label><Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="email">Email *</Label><Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="employee_id">Employee ID *</Label><Input id="employee_id" value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="department">Department</Label><Input id="department" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="designation">Designation</Label><Input id="designation" placeholder="e.g., Assistant Professor" value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} /></div>
                  <div className="space-y-2 col-span-2"><Label htmlFor="qualification">Qualification</Label><Input id="qualification" placeholder="e.g., M.Tech, PhD" value={formData.qualification} onChange={(e) => setFormData({ ...formData, qualification: e.target.value })} /></div>
                </div>

                <div className="space-y-3">
                  <Label>Assign to Course & Semesters</Label>
                  <div className="space-y-2">
                    <Label htmlFor="course_select" className="text-sm text-muted-foreground">Select Course First</Label>
                    <Select value={selectedCourse} onValueChange={(value) => { setSelectedCourse(value); setSelectedSemesters([]); }}>
                      <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                      <SelectContent>
                        {courses.map((course) => (<SelectItem key={course.id} value={course.id}>{course.name} ({course.code})</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedCourse && (
                    <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
                      <p className="text-sm text-muted-foreground mb-2">Select semesters and subjects to assign:</p>
                      {filteredSemesters.map((semester) => {
                        const isSelected = selectedSemesters.find(s => s.semester_id === semester.id);
                        const semesterSubjects = getSubjectsForSemester(semester.id);
                        return (
                          <div key={semester.id} className="space-y-2 p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Checkbox checked={!!isSelected} onCheckedChange={() => toggleSemester(semester.id)} />
                              <span className="text-sm font-medium">{semester.name}</span>
                            </div>
                            {isSelected && (
                              <div className="ml-7">
                                {semesterSubjects.length > 0 ? (
                                  <Select value={isSelected.subject_id || ''} onValueChange={(value) => {
                                    const subject = semesterSubjects.find(s => s.id === value);
                                    updateSubjectSelection(semester.id, value, subject?.name || '');
                                  }}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Select subject" /></SelectTrigger>
                                    <SelectContent>
                                      {semesterSubjects.map((subject) => (<SelectItem key={subject.id} value={subject.id}>{subject.name} ({subject.code})</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input placeholder="Enter subject name (no subjects defined)" value={isSelected.subject_name} onChange={(e) => updateSubjectSelection(semester.id, '', e.target.value)} className="text-sm" />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {filteredSemesters.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No semesters found for this course.</p>}
                    </div>
                  )}
                </div>

                <div className="bg-muted p-3 rounded-lg text-sm">
                  <p className="font-medium">Note:</p>
                  <p className="text-muted-foreground">Default password will be <code className="bg-background px-1 rounded">Welcome@123</code>.</p>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Teacher'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Teacher</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateTeacher} className="space-y-4 mt-4">
            {/* Photo Upload */}
            {editingTeacher && (
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={(editingTeacher.profile as any)?.avatar_url} />
                  <AvatarFallback>{(editingTeacher.profile as any)?.full_name?.charAt(0) || 'T'}</AvatarFallback>
                </Avatar>
                <Label htmlFor="teacher_photo" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-muted transition-colors text-sm">
                    <Upload className="w-4 h-4" /> Upload Photo
                  </div>
                  <input id="teacher_photo" type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && editingTeacher) handlePhotoUpload(editingTeacher.id, editingTeacher.profile_id, file);
                  }} />
                </Label>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="edit_full_name">Full Name *</Label><Input id="edit_full_name" value={editFormData.full_name} onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })} required /></div>
              <div className="space-y-2"><Label htmlFor="edit_phone">Phone</Label><Input id="edit_phone" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="edit_employee_id">Employee ID *</Label><Input id="edit_employee_id" value={editFormData.employee_id} onChange={(e) => setEditFormData({ ...editFormData, employee_id: e.target.value })} required /></div>
              <div className="space-y-2"><Label htmlFor="edit_department">Department</Label><Input id="edit_department" value={editFormData.department} onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="edit_designation">Designation</Label><Input id="edit_designation" placeholder="e.g., Assistant Professor" value={editFormData.designation} onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="edit_qualification">Qualification</Label><Input id="edit_qualification" placeholder="e.g., M.Tech, PhD" value={editFormData.qualification} onChange={(e) => setEditFormData({ ...editFormData, qualification: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : 'Update Teacher'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, employee ID, or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      {/* Teachers Table */}
      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filteredTeachers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Photo</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  {isAdmin && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher) => (
                  <TableRow key={teacher.id} className="table-row-hover">
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={(teacher.profile as any)?.avatar_url} />
                        <AvatarFallback className="text-xs">{(teacher.profile as any)?.full_name?.charAt(0) || 'T'}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{teacher.employee_id}</TableCell>
                    <TableCell className="font-medium">{(teacher.profile as any)?.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{(teacher.profile as any)?.email}</TableCell>
                    <TableCell>{teacher.department || '-'}</TableCell>
                    <TableCell>{teacher.designation || '-'}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditTeacher(teacher)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteTeacher(teacher.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No teachers found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
