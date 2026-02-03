import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ClipboardList, Calendar, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Student, Assignment, Attendance } from '@/types/database';
import { format } from 'date-fns';

interface StudentStats {
  totalAttendance: number;
  presentCount: number;
  pendingAssignments: number;
  submittedAssignments: number;
  totalMaterials: number;
}

export function StudentDashboard() {
  const { user, profile } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [stats, setStats] = useState<StudentStats>({
    totalAttendance: 0,
    presentCount: 0,
    pendingAssignments: 0,
    submittedAssignments: 0,
    totalMaterials: 0,
  });
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStudentData();
    }
  }, [user]);

  const fetchStudentData = async () => {
    try {
      // Get student record with course and semester
      const { data: studentData } = await supabase
        .from('students')
        .select(`
          *,
          course:courses(*),
          current_semester:semesters(*)
        `)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (studentData) {
        setStudent(studentData as Student);

        const semesterId = studentData.current_semester_id;

        // Fetch stats in parallel
        const [attendanceRes, submissionsRes, assignmentsRes, materialsRes, recentAttRes] = await Promise.all([
          supabase.from('attendance').select('status').eq('student_id', studentData.id),
          supabase.from('assignment_submissions').select('assignment_id').eq('student_id', studentData.id),
          semesterId 
            ? supabase.from('assignments').select('*').eq('semester_id', semesterId).eq('is_active', true)
            : Promise.resolve({ data: [] }),
          semesterId
            ? supabase.from('materials').select('id', { count: 'exact', head: true }).eq('semester_id', semesterId)
            : Promise.resolve({ count: 0 }),
          supabase.from('attendance')
            .select('*')
            .eq('student_id', studentData.id)
            .order('date', { ascending: false })
            .limit(5),
        ]);

        const presentCount = attendanceRes.data?.filter(a => a.status === 'present' || a.status === 'late').length || 0;
        const totalAttendance = attendanceRes.data?.length || 0;
        const submittedIds = submissionsRes.data?.map(s => s.assignment_id) || [];
        const allAssignments = assignmentsRes.data || [];
        const pending = allAssignments.filter(a => !submittedIds.includes(a.id) && new Date(a.due_date) > new Date());

        setStats({
          totalAttendance,
          presentCount,
          pendingAssignments: pending.length,
          submittedAssignments: submittedIds.length,
          totalMaterials: materialsRes.count || 0,
        });

        setPendingAssignments(pending.slice(0, 5) as Assignment[]);
        setRecentAttendance(recentAttRes.data as Attendance[] || []);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const attendancePercentage = stats.totalAttendance > 0 
    ? Math.round((stats.presentCount / stats.totalAttendance) * 100)
    : 0;

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Welcome, {profile?.full_name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {student?.roll_number} • {(student?.course as any)?.code || 'BCA'} • {(student?.current_semester as any)?.name || 'Semester'}
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        <Card className="stat-card card-interactive animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Attendance</p>
                <p className="text-3xl font-bold font-display mt-2">{attendancePercentage}%</p>
              </div>
              <div className="p-3 rounded-xl bg-success/10 text-success">
                <Calendar className="w-6 h-6" />
              </div>
            </div>
            <Progress value={attendancePercentage} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card className="stat-card card-interactive animate-fade-in" style={{ animationDelay: '50ms' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Assignments</p>
                <p className="text-3xl font-bold font-display mt-2">
                  {isLoading ? '...' : stats.pendingAssignments}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-warning/10 text-warning">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card card-interactive animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                <p className="text-3xl font-bold font-display mt-2">
                  {isLoading ? '...' : stats.submittedAssignments}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-student/10 text-student">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card card-interactive animate-fade-in" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Study Materials</p>
                <p className="text-3xl font-bold font-display mt-2">
                  {isLoading ? '...' : stats.totalMaterials}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-accent/10 text-accent">
                <FileText className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Pending Assignments */}
        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-warning" />
              Pending Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingAssignments.length > 0 ? (
              <div className="space-y-3">
                {pendingAssignments.map((assignment) => (
                  <div key={assignment.id} className="p-4 rounded-lg bg-muted/50 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Due: {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-warning/10 text-warning font-medium">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-2" />
                <p className="text-muted-foreground">All caught up! No pending assignments.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Attendance */}
        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-success" />
              Recent Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAttendance.length > 0 ? (
              <div className="space-y-3">
                {recentAttendance.map((record) => (
                  <div key={record.id} className="p-4 rounded-lg bg-muted/50 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{format(new Date(record.date), 'EEEE, MMM d')}</p>
                      <p className="text-sm text-muted-foreground capitalize">{record.remarks || 'No remarks'}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-medium capitalize status-${record.status}`}>
                      {record.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                No attendance records yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
