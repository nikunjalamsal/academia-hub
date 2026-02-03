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
  // For teachers
  employee_id?: string;
  department?: string;
  designation?: string;
  qualification?: string;
  semester_assignments?: { semester_id: string; subject_name: string }[];
  // For students
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client for user creation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify calling user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callingUser) {
      throw new Error("Invalid authentication token");
    }

    // Check if calling user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      throw new Error("Unauthorized: Only admins can create users");
    }

    const body: CreateUserRequest = await req.json();
    const { email, full_name, phone, role } = body;

    // Validate required fields
    if (!email || !full_name || !role) {
      throw new Error("Missing required fields: email, full_name, and role are required");
    }

    if (role === 'teacher' && !body.employee_id) {
      throw new Error("Employee ID is required for teachers");
    }

    if (role === 'student' && (!body.roll_number || !body.course_id || !body.current_semester_id || !body.enrollment_year)) {
      throw new Error("Roll number, course, semester, and enrollment year are required for students");
    }

    console.log(`Creating ${role} account for ${email}`);

    // Create auth user
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    });

    if (createUserError) {
      throw new Error(`Failed to create auth user: ${createUserError.message}`);
    }

    const userId = authData.user.id;
    console.log(`Auth user created with ID: ${userId}`);

    // Create profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: userId,
        email,
        full_name,
        phone,
        must_change_password: true,
      })
      .select()
      .single();

    if (profileError) {
      // Cleanup: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    console.log(`Profile created with ID: ${profileData.id}`);

    // Create user role
    const { error: userRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role,
      });

    if (userRoleError) {
      // Cleanup
      await supabaseAdmin.from("profiles").delete().eq("id", profileData.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create user role: ${userRoleError.message}`);
    }

    console.log(`User role created: ${role}`);

    let roleSpecificData = null;

    if (role === "teacher") {
      // Create teacher record
      const { data: teacherData, error: teacherError } = await supabaseAdmin
        .from("teachers")
        .insert({
          user_id: userId,
          profile_id: profileData.id,
          employee_id: body.employee_id,
          department: body.department,
          designation: body.designation,
          qualification: body.qualification,
        })
        .select()
        .single();

      if (teacherError) {
        // Cleanup
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("id", profileData.id);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Failed to create teacher record: ${teacherError.message}`);
      }

      console.log(`Teacher record created with ID: ${teacherData.id}`);

      // Create semester assignments if provided
      if (body.semester_assignments && body.semester_assignments.length > 0) {
        const assignments = body.semester_assignments.map((a) => ({
          teacher_id: teacherData.id,
          semester_id: a.semester_id,
          subject_name: a.subject_name,
        }));

        const { error: assignmentError } = await supabaseAdmin
          .from("teacher_semester_assignments")
          .insert(assignments);

        if (assignmentError) {
          console.error("Failed to create semester assignments:", assignmentError);
        }
      }

      roleSpecificData = teacherData;
    } else if (role === "student") {
      // Create student record
      const { data: studentData, error: studentError } = await supabaseAdmin
        .from("students")
        .insert({
          user_id: userId,
          profile_id: profileData.id,
          roll_number: body.roll_number,
          course_id: body.course_id,
          current_semester_id: body.current_semester_id,
          enrollment_year: body.enrollment_year,
          guardian_name: body.guardian_name,
          guardian_phone: body.guardian_phone,
          address: body.address,
        })
        .select()
        .single();

      if (studentError) {
        // Cleanup
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("id", profileData.id);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Failed to create student record: ${studentError.message}`);
      }

      console.log(`Student record created with ID: ${studentData.id}`);
      roleSpecificData = studentData;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully`,
        data: {
          user_id: userId,
          profile: profileData,
          [role]: roleSpecificData,
          default_password: DEFAULT_PASSWORD,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-user function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
