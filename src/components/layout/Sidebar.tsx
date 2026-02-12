import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileText, 
  Calendar, 
  ClipboardList,
  LogOut,
  Settings,
  ChevronLeft,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('admin' | 'teacher' | 'student')[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'teacher', 'student'],
  },
  {
    title: 'Students',
    href: '/students',
    icon: GraduationCap,
    roles: ['admin', 'teacher', 'student'],
  },
  {
    title: 'Teachers',
    href: '/teachers',
    icon: Users,
    roles: ['admin'],
  },
  {
    title: 'Faculty',
    href: '/faculty',
    icon: Users,
    roles: ['student'],
  },
  {
    title: 'Courses',
    href: '/courses',
    icon: BookOpen,
    roles: ['admin'],
  },
  {
    title: 'Materials',
    href: '/materials',
    icon: FileText,
    roles: ['admin', 'teacher', 'student'],
  },
  {
    title: 'Assignments',
    href: '/assignments',
    icon: ClipboardList,
    roles: ['admin', 'teacher', 'student'],
  },
  {
    title: 'Attendance',
    href: '/attendance',
    icon: Calendar,
    roles: ['admin', 'teacher', 'student'],
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin'],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { profile, role, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNavItems = navItems.filter(item => 
    role && item.roles.includes(role)
  );

  const getRoleBadgeClass = () => {
    switch (role) {
      case 'admin': return 'badge-admin';
      case 'teacher': return 'badge-teacher';
      case 'student': return 'badge-student';
      default: return 'bg-muted';
    }
  };

  return (
    <aside 
      className={cn(
        "sidebar-gradient border-r border-sidebar-border flex flex-col h-screen transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
              </div>
              <span className="font-display font-bold text-sidebar-foreground">
                BCA Portal
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="p-3 border-t border-sidebar-border">
        {!collapsed && profile && (
          <div className="mb-3 p-3 rounded-lg bg-sidebar-accent">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile.full_name}
            </p>
            <p className="text-xs text-sidebar-foreground/70 truncate">
              {profile.email}
            </p>
            <span className={cn(
              "inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full capitalize",
              getRoleBadgeClass()
            )}>
              {role}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={signOut}
          className={cn(
            "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive",
            collapsed ? "px-2" : "justify-start"
          )}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
