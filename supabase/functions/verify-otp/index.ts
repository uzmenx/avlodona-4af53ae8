import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  email: string;
  otp: string;
  password?: string;
  username?: string;
  gender?: string;
}

async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp, password, username, gender }: VerifyRequest = await req.json();

    const normalizedEmail = (email || "").toLowerCase().trim();

    if (!normalizedEmail || !otp) {
      return new Response(
        JSON.stringify({ error: "Email and OTP are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate OTP format
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: storedOtp, error: fetchError } = await admin
      .from("email_otp_codes")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("verified", false)
      .single();

    if (fetchError || !storedOtp) {
      return new Response(
        JSON.stringify({ error: "Kod topilmadi. Qaytadan urinib ko'ring" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (new Date(storedOtp.expires_at) < new Date()) {
      await admin.from("email_otp_codes").delete().eq("id", storedOtp.id);
      return new Response(
        JSON.stringify({ error: "Kod muddati tugagan. Yangi kod oling" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const inputHash = await hashOTP(otp);
    if (inputHash !== storedOtp.otp_hash) {
      return new Response(
        JSON.stringify({ error: "Noto'g'ri kod" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await admin.from("email_otp_codes").update({ verified: true }).eq("id", storedOtp.id);

    // Ensure user exists with confirmed email
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    const existing = listData.users.find((u: { email?: string; user_metadata?: Record<string, unknown>; id: string }) =>
      (u.email || "").toLowerCase() === normalizedEmail
    );

    let userId: string;

    if (existing) {
      const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        user_metadata: {
          ...(existing.user_metadata || {}),
          username: username || existing.user_metadata?.username,
        },
      });
      if (updateErr) throw updateErr;
      userId = existing.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          username: username || normalizedEmail,
          name: username || normalizedEmail,
        },
      });
      if (createErr) throw createErr;
      userId = created.user.id;

      const { error: profileError } = await admin
        .from("profiles")
        .update({
          username: username || normalizedEmail,
          name: username || normalizedEmail,
          gender: gender || null,
        })
        .eq("id", userId);
      if (profileError) {
        console.error("Profile update error:", profileError);
      }
    }

    // Now sign-in using anon key client so we can get real session tokens
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (signInError) throw signInError;

    await admin.from("email_otp_codes").delete().eq("email", normalizedEmail);

    return new Response(
      JSON.stringify({
        success: true,
        access_token: signInData.session?.access_token,
        refresh_token: signInData.session?.refresh_token,
        user: { id: userId, email: normalizedEmail },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
