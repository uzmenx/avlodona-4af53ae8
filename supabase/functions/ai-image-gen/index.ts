const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt) throw new Error("Prompt kerak");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: `Generate a high quality image: ${prompt}`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "So'rovlar limiti oshdi" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Kredit yetarli emas" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Image gen error:", response.status, t);
      return new Response(JSON.stringify({ error: "Rasm yaratishda xatolik", details: t.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("AI response structure:", JSON.stringify({
      keys: Object.keys(data),
      hasChoices: !!data?.choices,
      choicesLen: data?.choices?.length,
      msgKeys: data?.choices?.[0]?.message ? Object.keys(data.choices[0].message) : 'none',
      hasImages: !!data?.choices?.[0]?.message?.images,
      imagesLen: data?.choices?.[0]?.message?.images?.length,
    }));

    // Method 1: Check choices[].message.images[] (Lovable gateway format)
    const messageImages = data?.choices?.[0]?.message?.images;
    if (Array.isArray(messageImages) && messageImages.length > 0) {
      // Try both formats: {image_url: {url}} and {url}
      const firstImg = messageImages[0];
      const imgUrl = firstImg?.image_url?.url || firstImg?.url;
      if (imgUrl) {
        return new Response(JSON.stringify({ content: imgUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Method 2: Check data[].url or data[].b64_json (OpenAI images format)
    const fromImagesApi = (data as any)?.data?.[0];
    const imgUrl = fromImagesApi?.url as string | undefined;
    const b64 = fromImagesApi?.b64_json as string | undefined;

    if (imgUrl) {
      return new Response(JSON.stringify({ content: imgUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (b64) {
      return new Response(JSON.stringify({ content: `data:image/png;base64,${b64}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Method 3: Check choices[].message.content for inline data or URL
    const msgContent = data?.choices?.[0]?.message?.content as string | undefined;
    if (typeof msgContent === 'string') {
      const trimmed = msgContent.trim();
      const dataUrlMatch = trimmed.match(/data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+/i);
      if (dataUrlMatch) {
        return new Response(JSON.stringify({ content: dataUrlMatch[0] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const base64OnlyMatch = trimmed.match(/^[A-Za-z0-9+/=]{200,}$/);
      if (base64OnlyMatch) {
        return new Response(JSON.stringify({ content: `data:image/png;base64,${base64OnlyMatch[0]}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const urlMatch = trimmed.match(/https?:\/\/[^\s)\]]+/);
      if (urlMatch) {
        return new Response(JSON.stringify({ content: urlMatch[0] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Nothing found
    const safeSnapshot = (() => {
      try {
        const raw = JSON.stringify(data);
        return raw.length > 2000 ? raw.slice(0, 2000) + '…' : raw;
      } catch { return 'snapshot_failed'; }
    })();

    return new Response(
      JSON.stringify({
        error: "Rasm topilmadi",
        hint: "Provider rasm qaytarmadi yoki format mos emas.",
        snapshot: safeSnapshot,
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-image-gen error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Noma'lum xato" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
