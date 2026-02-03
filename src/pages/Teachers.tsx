import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Search, Loader2 } from 'lucide-react';
import { Teacher, Semester } from '@/types/database';

export default function Teachers() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    employee_id: '',
    department: '',
    designation: '',
    qualification: '',
  });
  const [selectedSemesters, setSelectedSemesters] = useState<{ semester_id: string; subject_name: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [teachersRes, semestersRes] = await Promise.all([
        supabase.from('teachers').select(`
          *,
          profile:profiles(*)
        `).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('semesters').select('*, course:courses(*)').order('semester_number'),
      ]);

      if (teachersRes.data) setTeachers(teachersRes.data as Teacher[]);
      if (semestersRes.data) setSemesters(semestersRes.data as Semester[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await supabase.functions.invoke('create-user', {
        body: {
          ...formData,
          role: 'teacher',
          semester_assignments: selectedSemesters.filter(s => s.subject_name),
        },
      });

      if (response.error) throw response.error;

      if (response.data?.success) {
        toast({
          title: 'Teacher Created',
          description: `${formData.full_name} has been added. Default password: Welcome@123`,
        });
        setIsDialogOpen(false);
        setFormData({
          email: '',
          full_name: '',
          phone: '',
          employee_id: '',
          department: '',
          designation: '',
          qualification: '',
        });
        setSelectedSemesters([]);
        fetchData();
      } else {
        throw new Error(response.data?.error || 'Failed to create teacher');
      }
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

  const toggleSemester = (semesterId: string) => {
    const exists = selectedSemesters.find(s => s.semester_id === semesterId);
    if (exists) {
      setSelectedSemesters(selectedSemesters.filter(s => s.semester_id !== semesterId));
    } else {
      setSelectedSemesters([...selectedSemesters, { semester_id: semesterId, subject_name: '' }]);
    }
  };

  const updateSubjectName = (semesterId: string, subjectName: string) => {
    setSelectedSemesters(selectedSemesters.map(s => 
      s.semester_id === semesterId ? { ...s, subject_name: subjectName } : s
    ));
  };

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
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTeacher} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee_id">Employee ID *</Label>
                    <Input
                      id="employee_id"
                      value={formData.employee_id}
                      onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation</Label>
                    <Input
                      id="designation"
                      placeholder="e.g., Assistant Professor"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="qualification">Qualification</Label>
                    <Input
                      id="qualification"
                      placeholder="e.g., M.Tech, PhD"
                      value={formData.qualification}
                      onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    />
                  </div>
                </div>

                {/* Semester Assignments */}
                <div className="space-y-3">
                  <Label>Assign to Semesters</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto space-y-3">
                    {semesters.map((semester) => {
                      const isSelected = selectedSemesters.find(s => s.semester_id === semester.id);
                      return (
                        <div key={semester.id} className="flex items-center gap-4">
                          <Checkbox
                            checked={!!isSelected}
                            onCheckedChange={() => toggleSemester(semester.id)}
                          />
                          <span className="text-sm font-medium w-24">{semester.name}</span>
                          {isSelected && (
                            <Input
                              placeholder="Subject name"
                              value={isSelected.subject_name}
                              onChange={(e) => updateSubjectName(semester.id, e.target.value)}
                              className="flex-1"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-lg text-sm">
                  <p className="font-medium">Note:</p>
                  <p className="text-muted-foreground">Default password will be <code className="bg-background px-1 rounded">Welcome@123</code>. The teacher will be prompted to change it on first login.</p>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Teacher'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, employee ID, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Teachers Table */}
      <Card className="mt-6">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTeachers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Qualification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher) => (
                  <TableRow key={teacher.id} className="table-row-hover">
                    <TableCell className="font-medium">{teacher.employee_id}</TableCell>
                    <TableCell>{(teacher.profile as any)?.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{(teacher.profile as any)?.email}</TableCell>
                    <TableCell>{teacher.department || '-'}</TableCell>
                    <TableCell>{teacher.designation || '-'}</TableCell>
                    <TableCell>{teacher.qualification || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No teachers found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
