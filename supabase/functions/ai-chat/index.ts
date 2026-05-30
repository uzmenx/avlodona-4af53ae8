/* eslint-disable */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function searchTavily(query: string, apiKey: string) {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        max_results: 3,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.results.map((r: any) => `${r.title}: ${r.content} (${r.url})`).join("\n\n");
  } catch (e) {
    console.error("Tavily search error:", e);
    return null;
  }
}

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

    const { messages, audio, mimeType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const currentDateStr = "Bugungi sana: " + new Date().toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' }) + ", Hozirgi vaqt: " + new Date().toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent' });

    const userQuery = messages[messages.length - 1]?.content || "";
    let searchContext = "";

    if (TAVILY_API_KEY && userQuery && !audio) {
      searchContext = await searchTavily(userQuery, TAVILY_API_KEY) || "";
    }

    const systemPrompt = `Sen "AI Do'stim" nomli do'stona va aqlli sun'iy intellekt yordamchisisan. 
Sening vazifang foydalanuvchiga do'st sifatida yordam berish. 
O'zbek tilida javob ber (agar foydalanuvchi boshqa tilda yozsa, o'sha tilda javob ber).
Javoblaringni qisqa, aniq va foydali qilib yoz.
Emoji ishlatishni unutma, lekin haddan tashqari ko'p ishlatma.
Agar foydalanuvchi salomlashsa, iliq va samimiy javob ber.
${currentDateStr}
${searchContext ? `Internet qidiruv natijalari:\n${searchContext}\n\nYuqoridagi ma'lumotlardan foydalanib javob ber.` : ""}`;

    const payload: any = {
      model: "google/gemini-1.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content
        }))
      ],
      stream: true,
      // Add Google Search Grounding tool
      tools: [{
        google_search: {}
      }]
    };

    if (audio && mimeType) {
      const lastMsgIdx = payload.messages.length - 1;
      const lastMsg = payload.messages[lastMsgIdx];
      
      if (lastMsg.role === 'user') {
        lastMsg.content = [
          { type: 'text', text: lastMsg.content || "Ovozli xabarni tahlil qil." },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${audio}` }
          }
        ];
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI xizmati xatosi" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai_chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Noma'lum xato" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
