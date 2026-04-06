import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, message, userEmail } = await req.json();

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not defined");
    }

    if (!subject || !message) {
      throw new Error("Missing required fields");
    }

    const emailContent = `
      yangi murojaat:
      Tasdiqlangan Foydalanuvchi: ${userEmail || 'Nomaʼlum (Tizimga kirmagan)'}
      Mavzu: ${subject}
      Murojaat matni:
      ${message}
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Avlodona <onboarding@resend.dev>", // usually onboarding@resend.dev for testing, or your verified domain
        to: "support@avlodona.com",
        reply_to: userEmail || "support@avlodona.com",
        subject: `Support: ${subject}`,
        text: emailContent,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend API error:", res.status, errorText);
      throw new Error(`Failed to send email: ${res.statusText}`);
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error sending support email:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
