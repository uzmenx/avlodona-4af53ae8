/* eslint-disable */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert OpenAI-style messages to Gemini API format
function toGeminiContents(messages: any[]) {
  return messages.map((m: any) => {
    const role = m.role === "assistant" ? "model" : "user";

    // If content is already an array (multimodal with images)
    if (Array.isArray(m.content)) {
      const parts: any[] = [];
      for (const part of m.content) {
        if (part.type === "text") {
          parts.push({ text: part.text || "" });
        } else if (part.type === "image_url" && part.image_url?.url) {
          const dataUrl: string = part.image_url.url;
          const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            parts.push({
              inlineData: {
                mimeType: matches[1],
                data: matches[2],
              },
            });
          }
        }
      }
      return { role, parts };
    }

    // Plain text content
    return { role, parts: [{ text: m.content || "" }] };
  });
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
      // Don't block if RPC fails - just log it and continue
      console.warn("Continuing despite RPC error...");
    } else if (!limitCheck || !limitCheck.allowed) {
      return new Response(JSON.stringify({ error: "Kundalik/oylik limit tugadi" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("VITE_GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const currentDateStr = "Bugungi sana: " + new Date().toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' }) + ", Hozirgi vaqt: " + new Date().toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent' });

    const systemInstruction = {
      parts: [{
        text: `Sen "AI Do'stim" nomli do'stona va aqlli sun'iy intellekt yordamchisisan.
Sening vazifang foydalanuvchiga do'st sifatida yordam berish.
O'zbek tilida javob ber (agar foydalanuvchi boshqa tilda yozsa, o'sha tilda javob ber).
Javoblaringni qisqa, aniq va foydali qilib yoz.
Emoji ishlatishni unutma, lekin haddan tashqari ko'p ishlatma.
Agar foydalanuvchi salomlashsa, iliq va samimiy javob ber.
Agar rasm yuborilsa, rasmni tahlil qil va foydalanuvchiga tushuntir.
${currentDateStr}`
      }]
    };

    // Convert messages to Gemini format
    const geminiContents = toGeminiContents(messages);

    const geminiPayload = {
      system_instruction: systemInstruction,
      contents: geminiContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    };

    // Use gemini-1.5-flash model with streaming
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiPayload),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      return new Response(JSON.stringify({ error: "Gemini xizmati xatosi: " + response.status }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE stream to OpenAI-compatible SSE stream
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) {
              const openaiChunk = {
                choices: [{ delta: { content } }]
              };
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify(openaiChunk)}\n\n`)
              );
            }

            // Check for finish reason
            const finishReason = parsed?.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
              console.warn("Gemini finish reason:", finishReason);
            }
          } catch (_) {
            // Skip malformed JSON lines
          }
        }
      },
      flush(controller) {
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      }
    });

    return new Response(response.body!.pipeThrough(transformStream), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("ai_chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Noma'lum xato" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
