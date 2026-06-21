import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { identifier } = await req.json();
    const raw = (identifier || "").toString().trim();
    if (!raw) return json({ error: "Identifikator kiriting" }, 400);

    // Already an email? Just normalize and return.
    if (EMAIL_REGEX.test(raw)) {
      return json({ email: raw.toLowerCase() });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    // Look up by username (case-insensitive, allow @ prefix)
    const uname = raw.replace(/^@/, "");
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", uname)
      .maybeSingle();

    if (profErr) {
      console.error("profiles lookup error:", profErr);
      return json({ error: "Foydalanuvchini tekshirib bo'lmadi" }, 500);
    }
    if (!profile) {
      return json({ error: "Bunday foydalanuvchi topilmadi" }, 404);
    }

    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(profile.id);
    if (userErr || !userRes?.user?.email) {
      console.error("getUserById error:", userErr);
      return json({ error: "Email topilmadi" }, 404);
    }

    return json({ email: userRes.user.email.toLowerCase() });
  } catch (e: any) {
    console.error("resolve-identifier fatal:", e?.message);
    return json({ error: "Xatolik yuz berdi" }, 500);
  }
});
