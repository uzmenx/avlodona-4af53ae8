import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OtpRequest {
  email: string;
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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: OtpRequest = await req.json();

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const normalizedEmail = (email || "").toLowerCase().trim();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentOtp } = await supabase
      .from("email_otp_codes")
      .select("id")
      .eq("email", normalizedEmail)
      .gte("created_at", oneMinuteAgo)
      .single();

    if (recentOtp) {
      return new Response(
        JSON.stringify({ error: "Iltimos, 60 soniya kuting" }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase
      .from("email_otp_codes")
      .delete()
      .eq("email", normalizedEmail);

    const { error: insertError } = await supabase
      .from("email_otp_codes")
      .insert({
        email: normalizedEmail,
        otp_hash: otpHash,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("Insert OTP error:", insertError);
      throw new Error("Failed to store OTP");
    }

    // Send email via Resend API
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Avlodona <onboarding@resend.dev>",
        to: [normalizedEmail],
        subject: "Sizning tasdiqlash kodingiz",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #16a34a; text-align: center;">Oilaviy</h1>
            <p style="font-size: 16px; text-align: center;">Sizning tasdiqlash kodingiz:</p>
            <div style="background: linear-gradient(135deg, #16a34a, #0ea5e9); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
              <span style="font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #666; text-align: center;">
              Bu kod 10 daqiqadan so'ng amal qilmaydi.
            </p>
            <p style="font-size: 12px; color: #999; text-align: center;">
              Agar siz bu kodni so'ramagan bo'lsangiz, ushbu xabarni e'tiborsiz qoldiring.
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error("Resend error:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    await res.json();

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
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
