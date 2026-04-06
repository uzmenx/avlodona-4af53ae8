import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { q, limit, lang, reverse, lat, lon } = (await req.json().catch(() => ({}))) as {
      q?: string;
      limit?: number;
      lang?: string;
      reverse?: boolean;
      lat?: number;
      lon?: number;
    };

    const acceptLang = (lang || "uz").toLowerCase();

    // Reverse geocoding
    if (reverse && lat !== undefined && lon !== undefined) {
      const searchParams = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        format: "json",
        "accept-language": acceptLang,
      });

      const url = `https://nominatim.openstreetmap.org/reverse?${searchParams.toString()}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "AvlodonaApp/1.0 (support@avlodona.com)", // Required by Nominatim Policy
        },
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: "Joylashuvni aniqlash imkonsiz (server xatosi)", status: res.status }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const data = await res.json();
      // Return as array for consistency
      return new Response(JSON.stringify(data?.place_id ? [data] : []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forward search
    const query = (q || "").trim();
    if (!query) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchParams = new URLSearchParams({
      q: query,
      format: "json",
      limit: String(typeof limit === "number" ? limit : 5),
      "accept-language": acceptLang,
    });

    const url = `https://nominatim.openstreetmap.org/search?${searchParams.toString()}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AvlodonaApp/1.0 (support@avlodona.com)", // Required by Nominatim Policy
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "Joy qidirishda xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.", status: res.status, details: text }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Joy qidirishda xatolik", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
