// Application types for the academic portal

export type AppRole = 'admin' | 'teacher' | 'student';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  duration_years: number;
  total_semesters: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface Semester {
  id: string;
  course_id: string;
  semester_number: number;
  name: string;
  is_active: boolean;
  created_at: string;
  course?: Course;
}

export interface Teacher {
  id: string;
  user_id: string;
  profile_id: string;
  employee_id: string;
  department?: string;
  designation?: string;
  qualification?: string;
  joining_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface TeacherSemesterAssignment {
  id: string;
  teacher_id: string;
  semester_id: string;
  subject_name: string;
  is_active: boolean;
  created_at: string;
  teacher?: Teacher;
  semester?: Semester;
}

export interface Student {
  id: string;
  user_id: string;
  profile_id: string;
  roll_number: string;
  course_id: string;
  current_semester_id?: string;
  enrollment_year: number;
  enrollment_date?: string;
  guardian_name?: string;
  guardian_phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  course?: Course;
  current_semester?: Semester;
}

export interface Subject {
  id: string;
  semester_id: string;
  name: string;
  code: string;
  credits: number;
  is_active: boolean;
  created_at: string;
  semester?: Semester;
}

export interface Material {
  id: string;
  teacher_id: string;
  semester_id: string;
  subject_id?: string;
  title: string;
  description?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  created_at: string;
  updated_at: string;
  teacher?: Teacher;
  semester?: Semester;
  subject?: Subject;
}

export interface Assignment {
  id: string;
  teacher_id: string;
  semester_id: string;
  subject_id?: string;
  title: string;
  description?: string;
  file_url?: string;
  file_name?: string;
  due_date: string;
  max_marks: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  teacher?: Teacher;
  semester?: Semester;
  subject?: Subject;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url?: string;
  file_name?: string;
  submitted_at: string;
  marks_obtained?: number;
  feedback?: string;
  graded_at?: string;
  graded_by?: string;
  assignment?: Assignment;
  student?: Student;
}

export interface Attendance {
  id: string;
  student_id: string;
  semester_id: string;
  subject_id?: string;
  teacher_id?: string;
  date: string;
  status: AttendanceStatus;
  remarks?: string;
  created_at: string;
  student?: Student;
  semester?: Semester;
  subject?: Subject;
  teacher?: Teacher;
}

// Form types for creating/updating
export interface CreateStudentForm {
  email: string;
  full_name: string;
  phone?: string;
  roll_number: string;
  course_id: string;
  current_semester_id: string;
  enrollment_year: number;
  guardian_name?: string;
  guardian_phone?: string;
  address?: string;
}

export interface CreateTeacherForm {
  email: string;
  full_name: string;
  phone?: string;
  employee_id: string;
  department?: string;
  designation?: string;
  qualification?: string;
}
