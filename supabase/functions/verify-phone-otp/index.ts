import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  phone: string;
  otp: string;
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
    const { phone, otp, username, gender }: VerifyOtpRequest = await req.json();

    const cleanPhone = phone.replace(/\D/g, "");

    if (!cleanPhone || !otp || otp.length !== 6) {
      return new Response(
        JSON.stringify({ error: "Telefon raqami va 6 xonali kodni kiriting" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get stored OTP
    const { data: storedOtp, error: fetchError } = await supabase
      .from("phone_otp_codes")
      .select("*")
      .eq("phone_number", cleanPhone)
      .eq("verified", false)
      .single();

    if (fetchError || !storedOtp) {
      return new Response(
        JSON.stringify({ error: "Kod topilmadi. Qaytadan urinib ko'ring" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    if (new Date(storedOtp.expires_at) < new Date()) {
      await supabase.from("phone_otp_codes").delete().eq("id", storedOtp.id);
      return new Response(
        JSON.stringify({ error: "Kod muddati tugagan. Yangi kod oling" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify OTP hash
    const inputHash = await hashOTP(otp);
    if (inputHash !== storedOtp.otp_hash) {
      return new Response(
        JSON.stringify({ error: "Noto'g'ri kod" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from("phone_otp_codes")
      .update({ verified: true })
      .eq("id", storedOtp.id);

    // Create email from phone number for Supabase Auth
    const fakeEmail = `${cleanPhone}@phone.oilaviy.uz`;
    const tempPassword = crypto.randomUUID();

    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === fakeEmail);

    let userId: string;
    let session: any;

    if (existingUser) {
      // Update password and sign in
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password: tempPassword
      });
      
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: tempPassword
      });

      if (signInError) throw signInError;
      userId = existingUser.id;
      session = signInData.session;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: fakeEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          phone: cleanPhone,
          username: username || cleanPhone,
        }
      });

      if (createError) throw createError;
      userId = newUser.user.id;

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          username: username || cleanPhone,
          name: username || cleanPhone,
          gender: gender || null,
        })
        .eq("id", userId);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }

      // Sign in the new user
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: tempPassword
      });

      if (signInError) throw signInError;
      session = signInData.session;
    }

    // Clean up OTP
    await supabase.from("phone_otp_codes").delete().eq("phone_number", cleanPhone);

    console.log(`User ${userId} authenticated via phone ${cleanPhone}`);

    return new Response(
      JSON.stringify({
        success: true,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: { id: userId, phone: cleanPhone }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in verify-phone-otp:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Xato yuz berdi" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
