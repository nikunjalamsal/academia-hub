import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, FileText, ClipboardList, Calendar, Users } from 'lucide-react';
import { Teacher, TeacherSemesterAssignment, Semester } from '@/types/database';

interface TeacherStats {
  totalStudents: number;
  totalAssignments: number;
  totalMaterials: number;
  attendanceToday: number;
}

export function TeacherDashboard() {
  const { user, profile } = useAuth();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<TeacherSemesterAssignment[]>([]);
  const [stats, setStats] = useState<TeacherStats>({
    totalStudents: 0,
    totalAssignments: 0,
    totalMaterials: 0,
    attendanceToday: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTeacherData();
    }
  }, [user]);

  const fetchTeacherData = async () => {
    try {
      // Get teacher record
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (teacherData) {
        setTeacher(teacherData as Teacher);

        // Get semester assignments
        const { data: assignmentData } = await supabase
          .from('teacher_semester_assignments')
          .select(`
            *,
            semester:semesters(*)
          `)
          .eq('teacher_id', teacherData.id)
          .eq('is_active', true);

        if (assignmentData) {
          setAssignments(assignmentData as TeacherSemesterAssignment[]);

          // Get stats
          const semesterIds = assignmentData.map(a => a.semester_id);
          
          const [studentsRes, assignmentsRes, materialsRes, attendanceRes] = await Promise.all([
            supabase.from('students').select('id', { count: 'exact', head: true }).in('current_semester_id', semesterIds).eq('is_active', true),
            supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherData.id).eq('is_active', true),
            supabase.from('materials').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherData.id).eq('is_active', true),
            supabase.from('attendance').select('id', { count: 'exact', head: true })
              .eq('teacher_id', teacherData.id)
              .eq('date', new Date().toISOString().split('T')[0]),
          ]);

          setStats({
            totalStudents: studentsRes.count || 0,
            totalAssignments: assignmentsRes.count || 0,
            totalMaterials: materialsRes.count || 0,
            attendanceToday: attendanceRes.count || 0,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching teacher data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    { title: 'My Students', value: stats.totalStudents, icon: GraduationCap, color: 'text-student' },
    { title: 'My Assignments', value: stats.totalAssignments, icon: ClipboardList, color: 'text-warning' },
    { title: 'My Materials', value: stats.totalMaterials, icon: FileText, color: 'text-accent' },
    { title: "Today's Attendance", value: stats.attendanceToday, icon: Calendar, color: 'text-success' },
  ];

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Welcome, {profile?.full_name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {teacher?.designation || 'Teacher'} • {teacher?.department || 'Department'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        {statCards.map((stat, index) => (
          <Card key={index} className="stat-card card-interactive animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold font-display mt-2">
                    {isLoading ? '...' : stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl bg-muted ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              My Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map((assignment, index) => (
                  <div key={index} className="p-4 rounded-lg bg-muted/50 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{assignment.subject_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(assignment.semester as any)?.name || 'Semester'}
                      </p>
                    </div>
                    <span className="badge-teacher px-2 py-1 rounded text-xs font-medium">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                No class assignments yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <a href="/students" className="p-4 rounded-lg bg-student/10 hover:bg-student/20 transition-colors text-center">
                <GraduationCap className="w-8 h-8 text-student mx-auto mb-2" />
                <span className="text-sm font-medium">View Students</span>
              </a>
              <a href="/assignments" className="p-4 rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors text-center">
                <ClipboardList className="w-8 h-8 text-warning mx-auto mb-2" />
                <span className="text-sm font-medium">Assignments</span>
              </a>
              <a href="/materials" className="p-4 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors text-center">
                <FileText className="w-8 h-8 text-accent mx-auto mb-2" />
                <span className="text-sm font-medium">Materials</span>
              </a>
              <a href="/attendance" className="p-4 rounded-lg bg-success/10 hover:bg-success/20 transition-colors text-center">
                <Calendar className="w-8 h-8 text-success mx-auto mb-2" />
                <span className="text-sm font-medium">Attendance</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
