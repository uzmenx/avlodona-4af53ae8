import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendOtpRequest {
  phone: string;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getEskizToken(): Promise<string> {
  const email = Deno.env.get("ESKIZ_EMAIL");
  const password = Deno.env.get("ESKIZ_PASSWORD");

  if (!email || !password) {
    throw new Error("Eskiz credentials not configured");
  }

  const response = await fetch("https://notify.eskiz.uz/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Eskiz auth error:", errorText);
    throw new Error("Failed to authenticate with Eskiz");
  }

  const data = await response.json();
  return data.data.token;
}

async function sendSMS(phone: string, message: string, token: string): Promise<void> {
  const response = await fetch("https://notify.eskiz.uz/api/message/sms/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mobile_phone: phone.replace(/\D/g, ""),
      message: message,
      from: "4546",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Eskiz SMS error:", errorText);
    throw new Error("Failed to send SMS");
  }

  const result = await response.json();
  console.log("SMS sent successfully:", result);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone }: SendOtpRequest = await req.json();

    // Validate phone number (Uzbekistan format)
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 9) {
      return new Response(
        JSON.stringify({ error: "Telefon raqamni to'g'ri kiriting" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limiting (1 OTP per 60 seconds)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentOtp } = await supabase
      .from("phone_otp_codes")
      .select("id")
      .eq("phone_number", cleanPhone)
      .gte("created_at", oneMinuteAgo)
      .single();

    if (recentOtp) {
      return new Response(
        JSON.stringify({ error: "Iltimos, 60 soniya kuting" }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate and hash OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3 minutes

    // Delete old OTPs for this phone
    await supabase
      .from("phone_otp_codes")
      .delete()
      .eq("phone_number", cleanPhone);

    // Store new OTP
    const { error: insertError } = await supabase
      .from("phone_otp_codes")
      .insert({
        phone_number: cleanPhone,
        otp_hash: otpHash,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("Insert OTP error:", insertError);
      throw new Error("Failed to store OTP");
    }

    // Get Eskiz token and send SMS
    const token = await getEskizToken();
    // Eskiz test mode only allows specific messages, append OTP to allowed text
    await sendSMS(cleanPhone, `Bu Eskiz dan test. Kod: ${otp}`, token);

    console.log(`OTP sent to ${cleanPhone}`);

    return new Response(
      JSON.stringify({ success: true, message: "OTP yuborildi" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-phone-otp:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Xato yuz berdi" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
