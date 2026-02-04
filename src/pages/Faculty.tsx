import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Search, Loader2, Mail, Phone, Briefcase, GraduationCap, Calendar, Award } from 'lucide-react';
import { Teacher } from '@/types/database';

export default function Faculty() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const { data } = await supabase
        .from('teachers')
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq('is_active', true)
        .order('created_at');

      if (data) setTeachers(data as Teacher[]);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsDetailDialogOpen(true);

    // Fetch teacher's semester assignments
    try {
      const { data } = await supabase
        .from('teacher_semester_assignments')
        .select(`
          *,
          semester:semesters(*, course:courses(*))
        `)
        .eq('teacher_id', teacher.id)
        .eq('is_active', true);

      if (data) setTeacherAssignments(data);
    } catch (error) {
      console.error('Error fetching teacher assignments:', error);
    }
  };

  const filteredTeachers = teachers.filter(teacher =>
    (teacher.profile as any)?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-teacher" />
            Faculty Members
          </h1>
          <p className="text-muted-foreground mt-1">View your teachers and faculty</p>
        </div>
      </div>

      {/* Search */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Faculty Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Faculty Details</DialogTitle>
          </DialogHeader>
          {selectedTeacher && (
            <div className="space-y-6 mt-4">
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-teacher/10 flex items-center justify-center">
                  <span className="text-3xl font-bold text-teacher">
                    {(selectedTeacher.profile as any)?.full_name?.charAt(0) || 'T'}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{(selectedTeacher.profile as any)?.full_name}</h3>
                  <p className="text-muted-foreground">{selectedTeacher.designation || 'Faculty'}</p>
                  <p className="text-sm text-muted-foreground">ID: {selectedTeacher.employee_id}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Contact Information</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{(selectedTeacher.profile as any)?.email}</span>
                  </div>
                  {(selectedTeacher.profile as any)?.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{(selectedTeacher.profile as any)?.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Professional Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  {selectedTeacher.department && (
                    <div className="flex items-start gap-3">
                      <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Department</p>
                        <p className="font-medium">{selectedTeacher.department}</p>
                      </div>
                    </div>
                  )}
                  {selectedTeacher.qualification && (
                    <div className="flex items-start gap-3">
                      <Award className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Qualification</p>
                        <p className="font-medium">{selectedTeacher.qualification}</p>
                      </div>
                    </div>
                  )}
                  {selectedTeacher.joining_date && (
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Joined</p>
                        <p className="font-medium">{new Date(selectedTeacher.joining_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Subjects Taught */}
              {teacherAssignments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Subjects Taught</h4>
                  <div className="space-y-2">
                    {teacherAssignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                        <GraduationCap className="w-4 h-4 text-primary" />
                        <div>
                          <p className="font-medium">{assignment.subject_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(assignment.semester as any)?.name} - {(assignment.semester as any)?.course?.code}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Faculty Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTeachers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {filteredTeachers.map((teacher, index) => (
            <Card
              key={teacher.id}
              className="card-interactive animate-fade-in cursor-pointer"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleViewDetails(teacher)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-teacher/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-teacher">
                      {(teacher.profile as any)?.full_name?.charAt(0) || 'T'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">
                      {(teacher.profile as any)?.full_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {teacher.designation || 'Faculty'}
                    </p>
                    <div className="mt-3 space-y-2">
                      {teacher.department && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Briefcase className="w-4 h-4" />
                          <span>{teacher.department}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{(teacher.profile as any)?.email}</span>
                      </div>
                      {(teacher.profile as any)?.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          <span>{(teacher.profile as any)?.phone}</span>
                        </div>
                      )}
                    </div>
                    {teacher.qualification && (
                      <div className="mt-3">
                        <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                          {teacher.qualification}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-accent mt-4 text-center">Click to view details</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No faculty members found</p>
        </div>
      )}
    </div>
  );
}
