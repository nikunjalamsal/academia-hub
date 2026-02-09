import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Loader2, Check, X, Clock, AlertCircle, Save } from 'lucide-react';
import { Attendance, Semester, Teacher, Student, Subject, Course } from '@/types/database';
import { format } from 'date-fns';

export default function AttendancePage() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [teacherAssignments, setTeacherAssignments] = useState<{ semester_id: string; subject_id: string | null; subject_name: string }[]>([]);

  useEffect(() => { fetchData(); }, [user, role]);

  const fetchData = async () => {
    try {
      if (role === 'teacher' && user) {
        const { data: teacherData } = await supabase.from('teachers').select('*').eq('user_id', user.id).maybeSingle();
        if (teacherData) {
          setTeacher(teacherData as Teacher);

          const { data: assignmentsData } = await supabase
            .from('teacher_semester_assignments')
            .select('semester_id, subject_id, subject_name')
            .eq('teacher_id', teacherData.id)
            .eq('is_active', true);

          const assignments = assignmentsData || [];
          setTeacherAssignments(assignments);

          const semesterIds = [...new Set(assignments.map(a => a.semester_id))];

          if (semesterIds.length > 0) {
            const { data: semData } = await supabase.from('semesters').select('*, course:courses(*)').in('id', semesterIds);
            if (semData) {
              setSemesters(semData as Semester[]);
              // Extract unique courses from these semesters
              const courseMap = new Map<string, Course>();
              semData.forEach((s: any) => { if (s.course) courseMap.set(s.course.id, s.course); });
              setCourses(Array.from(courseMap.values()));
            }
          }
        }
      } else if (role === 'student' && user) {
        const { data: studentData } = await supabase
          .from('students')
          .select('*, course:courses(*), current_semester:semesters(*)')
          .eq('user_id', user.id)
          .maybeSingle();

        if (studentData) {
          setStudent(studentData as Student);
          const { data } = await supabase
            .from('attendance')
            .select('*, subject:subjects(*)')
            .eq('student_id', studentData.id)
            .order('date', { ascending: false });
          if (data) setAttendance(data as Attendance[]);
        }
      } else if (role === 'admin') {
        const [semRes, courseRes] = await Promise.all([
          supabase.from('semesters').select('*, course:courses(*)').order('semester_number'),
          supabase.from('courses').select('*').eq('is_active', true),
        ]);
        if (semRes.data) setSemesters(semRes.data as Semester[]);
        if (courseRes.data) setCourses(courseRes.data as Course[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally { setIsLoading(false); }
  };

  // When course changes, reset semester/subject
  useEffect(() => {
    setSelectedSemester('');
    setSelectedSubject('');
    setStudents([]);
    setSubjects([]);
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedSemester && (role === 'teacher' || role === 'admin')) {
      fetchStudentsAndSubjects();
    }
  }, [selectedSemester]);

  useEffect(() => {
    if (selectedSemester && selectedSubject && selectedDate && (role === 'teacher' || role === 'admin')) {
      fetchExistingAttendance();
    }
  }, [selectedSemester, selectedSubject, selectedDate]);

  const fetchStudentsAndSubjects = async () => {
    try {
      const { data: studentsData } = await supabase
        .from('students')
        .select('*, profile:profiles(*)')
        .eq('current_semester_id', selectedSemester)
        .eq('is_active', true)
        .order('roll_number');

      if (studentsData) setStudents(studentsData as Student[]);

      if (role === 'teacher') {
        const assignedSubjectIds = teacherAssignments
          .filter(a => a.semester_id === selectedSemester && a.subject_id)
          .map(a => a.subject_id!);

        if (assignedSubjectIds.length > 0) {
          const { data: subjectsData } = await supabase
            .from('subjects')
            .select('*')
            .in('id', assignedSubjectIds)
            .eq('is_active', true);

          if (subjectsData) {
            setSubjects(subjectsData as Subject[]);
            if (subjectsData.length > 0 && !selectedSubject) setSelectedSubject(subjectsData[0].id);
          }
        } else {
          setSubjects([]);
          setSelectedSubject('');
        }
      } else {
        const { data: subjectsData } = await supabase
          .from('subjects')
          .select('*')
          .eq('semester_id', selectedSemester)
          .eq('is_active', true);

        if (subjectsData) {
          setSubjects(subjectsData as Subject[]);
          if (subjectsData.length > 0 && !selectedSubject) setSelectedSubject(subjectsData[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchExistingAttendance = async () => {
    try {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('semester_id', selectedSemester)
        .eq('subject_id', selectedSubject)
        .eq('date', selectedDate);

      const map: Record<string, string> = {};
      data?.forEach(a => { map[a.student_id] = a.status; });
      setAttendanceMap(map);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const handleAttendanceChange = (studentId: string, status: string) => {
    setAttendanceMap({ ...attendanceMap, [studentId]: status });
  };

  const handleSaveAttendance = async () => {
    if (!teacher && role !== 'admin') return;
    if (!selectedSubject || !selectedSemester) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select course, semester, and subject.' });
      return;
    }

    setIsSaving(true);
    try {
      const records = Object.entries(attendanceMap).map(([studentId, status]) => ({
        student_id: studentId,
        semester_id: selectedSemester,
        subject_id: selectedSubject,
        teacher_id: teacher?.id,
        date: selectedDate,
        status,
      }));

      await supabase.from('attendance').delete()
        .eq('semester_id', selectedSemester)
        .eq('subject_id', selectedSubject)
        .eq('date', selectedDate);

      const { error } = await supabase.from('attendance').insert(records);
      if (error) throw error;

      toast({ title: 'Attendance Saved', description: 'Attendance has been recorded successfully.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally { setIsSaving(false); }
  };

  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';
  const isAdmin = role === 'admin';

  // Filter semesters by selected course
  const filteredSemesters = selectedCourse
    ? semesters.filter(s => s.course_id === selectedCourse)
    : semesters;

  // For teachers, further filter semesters to only assigned ones
  const availableSemesters = isTeacher
    ? filteredSemesters.filter(s => teacherAssignments.some(a => a.semester_id === s.id))
    : filteredSemesters;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <Check className="w-4 h-4 text-success" />;
      case 'absent': return <X className="w-4 h-4 text-destructive" />;
      case 'late': return <Clock className="w-4 h-4 text-warning" />;
      case 'excused': return <AlertCircle className="w-4 h-4 text-accent" />;
      default: return null;
    }
  };

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Calendar className="w-8 h-8 text-success" />
            Attendance
          </h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher ? 'Take attendance for your assigned subjects' : isStudent ? 'View your attendance' : 'Manage attendance records'}
          </p>
        </div>
      </div>

      {/* Student View */}
      {isStudent && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Your Attendance History</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : attendance.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{(record.subject as any)?.name || '-'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium capitalize status-${record.status}`}>
                          {getStatusIcon(record.status)}
                          {record.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{record.remarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No attendance records yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Teacher/Admin View */}
      {(isTeacher || isAdmin) && (
        <>
          <Card className="mt-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Course</label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>{course.name} ({course.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Semester</label>
                  <Select value={selectedSemester} onValueChange={setSelectedSemester} disabled={!selectedCourse}>
                    <SelectTrigger><SelectValue placeholder={!selectedCourse ? 'Select course first' : 'Select semester'} /></SelectTrigger>
                    <SelectContent>
                      {availableSemesters.map((semester) => (
                        <SelectItem key={semester.id} value={semester.id}>{semester.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Subject</label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedSemester}>
                    <SelectTrigger><SelectValue placeholder={subjects.length === 0 ? 'No assigned subjects' : 'Select subject'} /></SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mark Attendance</CardTitle>
              <Button onClick={handleSaveAttendance} disabled={isSaving || students.length === 0 || !selectedSubject || !selectedSemester || !selectedCourse}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Attendance
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : !selectedCourse || !selectedSemester ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a course and semester to begin.</p>
                </div>
              ) : !selectedSubject ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {isTeacher ? 'No subjects assigned for this semester. Contact admin.' : 'Select a subject to mark attendance.'}
                  </p>
                </div>
              ) : students.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roll No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((stu) => (
                      <TableRow key={stu.id}>
                        <TableCell className="font-medium">{stu.roll_number}</TableCell>
                        <TableCell>{(stu.profile as any)?.full_name}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {['present', 'absent', 'late', 'excused'].map((status) => (
                              <Button
                                key={status}
                                size="sm"
                                variant={attendanceMap[stu.id] === status ? 'default' : 'outline'}
                                className={`capitalize ${
                                  attendanceMap[stu.id] === status
                                    ? status === 'present' ? 'bg-success hover:bg-success/90' :
                                      status === 'absent' ? 'bg-destructive hover:bg-destructive/90' :
                                      status === 'late' ? 'bg-warning hover:bg-warning/90' :
                                      'bg-accent hover:bg-accent/90'
                                    : ''
                                }`}
                                onClick={() => handleAttendanceChange(stu.id, status)}
                              >
                                {status}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No students in this semester</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
