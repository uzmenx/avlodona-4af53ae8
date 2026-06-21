import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  email: string;
  otp: string;
  password?: string;
  username?: string;
  gender?: string;
  purpose?: string;
}

async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function findUserByEmail(admin: any, email: string) {
  // Paginated search to avoid the 1000-user perPage cap
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("listUsers error:", error);
      return null;
    }
    const users = data?.users || [];
    const match = users.find(
      (u: any) => (u.email || "").toLowerCase() === email
    );
    if (match) return match;
    if (users.length < perPage) break;
  }
  return null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp, password, username, gender, purpose }: VerifyRequest =
      await req.json();

    const normalizedEmail = (email || "").toLowerCase().trim();
    const isReset = purpose === "reset";

    if (!normalizedEmail || !otp) {
      return jsonResponse({ error: "Email va kod talab qilinadi" }, 400);
    }

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return jsonResponse({ error: "Kod formati noto'g'ri" }, 400);
    }

    if (!password || password.length < 6) {
      return jsonResponse(
        { error: "Parol kamida 6 ta belgi bo'lishi kerak" },
        400
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: storedOtp, error: fetchError } = await admin
      .from("email_otp_codes")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch OTP error:", fetchError);
      return jsonResponse(
        { error: "Kodni tekshirib bo'lmadi. Qaytadan urinib ko'ring" },
        500
      );
    }
    if (!storedOtp) {
      return jsonResponse(
        { error: "Kod topilmadi. Yangi kod oling" },
        400
      );
    }

    if (new Date(storedOtp.expires_at) < new Date()) {
      await admin.from("email_otp_codes").delete().eq("id", storedOtp.id);
      return jsonResponse(
        { error: "Kod muddati tugagan. Yangi kod oling" },
        400
      );
    }

    const inputHash = await hashOTP(otp);
    if (inputHash !== storedOtp.otp_hash) {
      return jsonResponse({ error: "Noto'g'ri kod" }, 400);
    }

    await admin
      .from("email_otp_codes")
      .update({ verified: true })
      .eq("id", storedOtp.id);

    const existing = await findUserByEmail(admin, normalizedEmail);

    let userId: string;

    if (existing) {
      // RESET or returning user: update password only. Do NOT overwrite metadata in reset.
      const updatePayload: any = { password };
      if (!existing.email_confirmed_at) {
        updatePayload.email_confirm = true;
      }
      if (!isReset && username) {
        updatePayload.user_metadata = {
          ...(existing.user_metadata || {}),
          username,
        };
      }

      const { error: updateErr } = await admin.auth.admin.updateUserById(
        existing.id,
        updatePayload
      );
      if (updateErr) {
        console.error("updateUserById error:", {
          message: updateErr.message,
          status: (updateErr as any).status,
          code: (updateErr as any).code,
        });
        return jsonResponse(
          { error: "Parolni yangilab bo'lmadi: " + updateErr.message },
          500
        );
      }
      userId = existing.id;
    } else {
      if (isReset) {
        return jsonResponse(
          { error: "Bu email bilan foydalanuvchi topilmadi" },
          400
        );
      }
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: {
            username: username || normalizedEmail,
            name: username || normalizedEmail,
          },
        });
      if (createErr) {
        console.error("createUser error:", createErr);
        return jsonResponse(
          { error: "Foydalanuvchi yaratib bo'lmadi: " + createErr.message },
          500
        );
      }
      userId = created.user.id;

      const { error: profileError } = await admin
        .from("profiles")
        .update({
          username: username || normalizedEmail,
          name: username || normalizedEmail,
          gender: gender || null,
        })
        .eq("id", userId);
      if (profileError) {
        console.error("Profile update error:", profileError);
      }
    }

    // Sign in to obtain real session tokens
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: signInData, error: signInError } =
      await client.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
    if (signInError) {
      console.error("signInWithPassword error:", {
        message: signInError.message,
        status: (signInError as any).status,
        code: (signInError as any).code,
      });
      return jsonResponse(
        {
          error:
            "Parol yangilandi, lekin avtomatik kirib bo'lmadi. Iltimos, qaytadan login qiling.",
          requireLogin: true,
        },
        200
      );
    }

    await admin
      .from("email_otp_codes")
      .delete()
      .eq("email", normalizedEmail);

    return jsonResponse({
      success: true,
      access_token: signInData.session?.access_token,
      refresh_token: signInData.session?.refresh_token,
      user: { id: userId, email: normalizedEmail },
    });
  } catch (error: any) {
    console.error("verify-otp fatal error:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return jsonResponse(
      { error: "Xatolik yuz berdi: " + (error?.message || "noma'lum") },
      500
    );
  }
};

serve(handler);
