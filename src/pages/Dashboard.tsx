import { useAuth } from '@/contexts/AuthContext';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { TeacherDashboard } from '@/components/dashboard/TeacherDashboard';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';

export default function Dashboard() {
  const { role } = useAuth();

  switch (role) {
    case 'admin':
      return <AdminDashboard />;
    case 'teacher':
      return <TeacherDashboard />;
    case 'student':
      return <StudentDashboard />;
    default:
      return (
        <div className="page-container">
          <p>Loading dashboard...</p>
        </div>
      );
  }
}
