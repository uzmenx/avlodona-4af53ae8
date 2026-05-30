import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};



serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: limitCheck, error: limitError } = await supabaseClient.rpc(
      "check_and_increment_chat",
      { p_user_id: user.id }
    );

    if (limitError) {
      console.error("RPC Error:", limitError);
      return new Response(JSON.stringify({ error: "Limitlarni tekshirishda xatolik" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!limitCheck || !limitCheck.allowed) {
      return new Response(JSON.stringify({ error: "Kundalik/oylik limit tugadi" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const currentDateStr = "Bugungi sana: " + new Date().toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' }) + ", Hozirgi vaqt: " + new Date().toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent' });

    const systemPrompt = `Sen professional AI yordamchisan - "AI Do'stim".

QOIDALAR:
- Sen har doim foydalanuvchiga hurmat bilan, "Siz" deb murojaat qilasan.
- Javoblaring aniq, lo'nda va foydali bo'lsin.
- O'zbek tilida mukammal va adabiy tilda yoz (agar foydalanuvchi boshqa tilda yozsa, o'sha tilda javob ber).
- Agar foydalanuvchi kod so'rasa, eng yaxshi va zamonaviy yechimlarni ber.
- Hech qachon yolg'on ma'lumot berma, agar bilmasang, bilmasligingni ayt.
- Samimiy va do'stona bo'l, lekin professionalizmni saqlab qol.
- Emoji ishlatishni unutma, lekin haddan tashqari ko'p ishlatma.

${currentDateStr}`;

    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "So'rovlar limiti oshdi, keyinroq urinib ko'ring." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Groq API error:", response.status, t);
      return new Response(JSON.stringify({ error: "Groq xizmati xatosi" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat-groq error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Noma'lum xato" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
