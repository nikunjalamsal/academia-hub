import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log("Setting up initial admin user...");

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const adminEmail = "admin@bca.edu";
    const adminPassword = "Welcome@123";

    // Check if admin already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const adminExists = existingUsers?.users?.some(u => u.email === adminEmail);

    if (adminExists) {
      console.log("Admin user already exists");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Admin user already exists",
          credentials: {
            email: adminEmail,
            password: "Use your existing password",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create auth user
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
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
        email: adminEmail,
        full_name: "System Administrator",
        must_change_password: true,
      })
      .select()
      .single();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    console.log(`Profile created with ID: ${profileData.id}`);

    // Create admin role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "admin",
      });

    if (roleError) {
      await supabaseAdmin.from("profiles").delete().eq("id", profileData.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create admin role: ${roleError.message}`);
    }

    console.log("Admin role assigned successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin user created successfully",
        credentials: {
          email: adminEmail,
          password: adminPassword,
          note: "You will be required to change this password on first login",
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error setting up admin:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
