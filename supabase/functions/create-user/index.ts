import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateUserRequest {
  email: string;
  full_name: string;
  phone?: string;
  role: 'teacher' | 'student';
  employee_id?: string;
  department?: string;
  designation?: string;
  qualification?: string;
  semester_assignments?: { semester_id: string; subject_name: string; subject_id?: string }[];
  roll_number?: string;
  course_id?: string;
  current_semester_id?: string;
  enrollment_year?: number;
  guardian_name?: string;
  guardian_phone?: string;
  address?: string;
}

const DEFAULT_PASSWORD = "Welcome@123";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callingUser) throw new Error("Invalid authentication token");

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", callingUser.id).single();
    if (roleError || roleData?.role !== "admin") throw new Error("Unauthorized: Only admins can create users");

    const body: CreateUserRequest = await req.json();
    const { email, full_name, phone, role } = body;

    if (!email || !full_name || !role) throw new Error("Missing required fields: email, full_name, and role are required");
    if (role === 'teacher' && !body.employee_id) throw new Error("Employee ID is required for teachers");
    if (role === 'student' && (!body.roll_number || !body.course_id || !body.current_semester_id || !body.enrollment_year)) {
      throw new Error("Roll number, course, semester, and enrollment year are required for students");
    }

    console.log(`Creating ${role} account for ${email}`);

    // Check if a deactivated record exists for this email
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles").select("id, user_id").eq("email", email).maybeSingle();

    if (existingProfile) {
      // User already exists - check if their role-specific record is deactivated
      if (role === 'teacher') {
        const { data: deactivatedTeacher } = await supabaseAdmin
          .from("teachers").select("id").eq("user_id", existingProfile.user_id).eq("is_active", false).maybeSingle();
        
        if (deactivatedTeacher) {
          // Reactivate the teacher
          await supabaseAdmin.from("teachers").update({
            is_active: true,
            department: body.department || null,
            designation: body.designation || null,
            qualification: body.qualification || null,
          }).eq("id", deactivatedTeacher.id);

          // Update profile
          await supabaseAdmin.from("profiles").update({
            full_name, phone: phone || null,
          }).eq("id", existingProfile.id);

          // Update semester assignments if provided
          if (body.semester_assignments && body.semester_assignments.length > 0) {
            // Deactivate old assignments
            await supabaseAdmin.from("teacher_semester_assignments").update({ is_active: false }).eq("teacher_id", deactivatedTeacher.id);
            
            const assignments = body.semester_assignments.map((a) => ({
              teacher_id: deactivatedTeacher.id,
              semester_id: a.semester_id,
              subject_name: a.subject_name,
              subject_id: a.subject_id || null,
            }));
            await supabaseAdmin.from("teacher_semester_assignments").insert(assignments);
          }

          return new Response(JSON.stringify({
            success: true,
            message: "Teacher reactivated successfully",
            data: { user_id: existingProfile.user_id, reactivated: true },
          }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        // Check if active teacher exists
        const { data: activeTeacher } = await supabaseAdmin
          .from("teachers").select("id").eq("user_id", existingProfile.user_id).eq("is_active", true).maybeSingle();
        if (activeTeacher) {
          throw new Error("A teacher with this email already exists and is active.");
        }
      } else if (role === 'student') {
        const { data: deactivatedStudent } = await supabaseAdmin
          .from("students").select("id").eq("user_id", existingProfile.user_id).eq("is_active", false).maybeSingle();
        
        if (deactivatedStudent) {
          await supabaseAdmin.from("students").update({
            is_active: true,
            course_id: body.course_id,
            current_semester_id: body.current_semester_id,
            enrollment_year: body.enrollment_year,
            guardian_name: body.guardian_name || null,
            guardian_phone: body.guardian_phone || null,
            address: body.address || null,
          }).eq("id", deactivatedStudent.id);

          await supabaseAdmin.from("profiles").update({
            full_name, phone: phone || null,
          }).eq("id", existingProfile.id);

          return new Response(JSON.stringify({
            success: true,
            message: "Student reactivated successfully",
            data: { user_id: existingProfile.user_id, reactivated: true },
          }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        const { data: activeStudent } = await supabaseAdmin
          .from("students").select("id").eq("user_id", existingProfile.user_id).eq("is_active", true).maybeSingle();
        if (activeStudent) {
          throw new Error("A student with this email already exists and is active.");
        }
      }

      // If we get here, the user exists but has a different role or situation
      throw new Error(`A user with email ${email} already exists.`);
    }

    // No existing profile - create fresh user
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email, password: DEFAULT_PASSWORD, email_confirm: true,
    });
    if (createUserError) throw new Error(`Failed to create auth user: ${createUserError.message}`);

    const userId = authData.user.id;
    console.log(`Auth user created with ID: ${userId}`);

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles").insert({ user_id: userId, email, full_name, phone, must_change_password: true }).select().single();
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    const { error: userRoleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
    if (userRoleError) {
      await supabaseAdmin.from("profiles").delete().eq("id", profileData.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create user role: ${userRoleError.message}`);
    }

    let roleSpecificData = null;

    if (role === "teacher") {
      const { data: teacherData, error: teacherError } = await supabaseAdmin
        .from("teachers").insert({
          user_id: userId, profile_id: profileData.id, employee_id: body.employee_id,
          department: body.department, designation: body.designation, qualification: body.qualification,
        }).select().single();
      if (teacherError) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("id", profileData.id);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Failed to create teacher record: ${teacherError.message}`);
      }

      if (body.semester_assignments && body.semester_assignments.length > 0) {
        const assignments = body.semester_assignments.map((a) => ({
          teacher_id: teacherData.id,
          semester_id: a.semester_id,
          subject_name: a.subject_name,
          subject_id: a.subject_id || null,
        }));
        const { error: assignmentError } = await supabaseAdmin.from("teacher_semester_assignments").insert(assignments);
        if (assignmentError) console.error("Failed to create semester assignments:", assignmentError);
      }
      roleSpecificData = teacherData;
    } else if (role === "student") {
      const { data: studentData, error: studentError } = await supabaseAdmin
        .from("students").insert({
          user_id: userId, profile_id: profileData.id, roll_number: body.roll_number,
          course_id: body.course_id, current_semester_id: body.current_semester_id,
          enrollment_year: body.enrollment_year, guardian_name: body.guardian_name,
          guardian_phone: body.guardian_phone, address: body.address,
        }).select().single();
      if (studentError) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("id", profileData.id);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Failed to create student record: ${studentError.message}`);
      }
      roleSpecificData = studentData;
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully`,
      data: { user_id: userId, profile: profileData, [role]: roleSpecificData, default_password: DEFAULT_PASSWORD },
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in create-user function:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
