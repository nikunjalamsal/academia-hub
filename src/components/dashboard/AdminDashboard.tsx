import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, Users, BookOpen, FileText, Calendar, TrendingUp } from 'lucide-react';

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalAssignments: number;
  totalMaterials: number;
  attendanceToday: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
    totalCourses: 0,
    totalAssignments: 0,
    totalMaterials: 0,
    attendanceToday: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [students, teachers, courses, assignments, materials, attendance] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('materials').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', new Date().toISOString().split('T')[0]),
      ]);

      setStats({
        totalStudents: students.count || 0,
        totalTeachers: teachers.count || 0,
        totalCourses: courses.count || 0,
        totalAssignments: assignments.count || 0,
        totalMaterials: materials.count || 0,
        attendanceToday: attendance.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    { title: 'Total Students', value: stats.totalStudents, icon: GraduationCap, color: 'text-student' },
    { title: 'Total Teachers', value: stats.totalTeachers, icon: Users, color: 'text-teacher' },
    { title: 'Active Courses', value: stats.totalCourses, icon: BookOpen, color: 'text-primary' },
    { title: 'Assignments', value: stats.totalAssignments, icon: FileText, color: 'text-warning' },
    { title: 'Study Materials', value: stats.totalMaterials, icon: FileText, color: 'text-accent' },
    { title: "Today's Attendance", value: stats.attendanceToday, icon: Calendar, color: 'text-success' },
  ];

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of the academic portal</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
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
        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <a href="/students" className="p-4 rounded-lg bg-student/10 hover:bg-student/20 transition-colors text-center">
                <GraduationCap className="w-8 h-8 text-student mx-auto mb-2" />
                <span className="text-sm font-medium">Add Student</span>
              </a>
              <a href="/teachers" className="p-4 rounded-lg bg-teacher/10 hover:bg-teacher/20 transition-colors text-center">
                <Users className="w-8 h-8 text-teacher mx-auto mb-2" />
                <span className="text-sm font-medium">Add Teacher</span>
              </a>
              <a href="/courses" className="p-4 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-center">
                <BookOpen className="w-8 h-8 text-primary mx-auto mb-2" />
                <span className="text-sm font-medium">Manage Courses</span>
              </a>
              <a href="/attendance" className="p-4 rounded-lg bg-success/10 hover:bg-success/20 transition-colors text-center">
                <Calendar className="w-8 h-8 text-success mx-auto mb-2" />
                <span className="text-sm font-medium">View Attendance</span>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '400ms' }}>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm text-center py-8">
                Activity feed will appear here as users interact with the system
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
