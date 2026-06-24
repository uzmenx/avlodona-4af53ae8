import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── FCM v1 API uchun Google OAuth token ──────────────────────────────────────

async function getAccessToken(clientEmail: string, privateKey: string) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodeBase64Url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const unsignedToken = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}`;

  const keyBuffer = Uint8Array.from(
    atob(privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\n|\n/g, '')),
    (c) => c.charCodeAt(0)
  );

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureBase64Url = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signatureBase64Url}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const data = await response.json();
  return data.access_token as string;
}

// ─── Notification type → o'zbek matni ─────────────────────────────────────────

function buildNotifText(type: string, actorName: string): string {
  const labels: Record<string, string> = {
    follow:                     `${actorName} sizni kuzata boshladi`,
    follow_request:             `${actorName} kuzatish so'radi`,
    like:                       `${actorName} postingizni yoqtirdi`,
    story_like:                 `${actorName} hikoyangizni yoqtirdi`,
    comment:                    `${actorName} izoh qoldirdi`,
    story:                      `${actorName} yangi hikoya joyladi`,
    message:                    `${actorName} xabar yubordi`,
    calendar_event:             `${actorName} — kalendar voqeasi`,
    mention:                    `${actorName} sizni belgiladi`,
    collab_request:             `${actorName} hamkorlik so'radi`,
    collab_accepted:            `${actorName} hamkorlikni qabul qildi`,
    family_invitation:          `${actorName} oila daraxtiga taklif qildi`,
    family_invitation_accepted: `${actorName} oila daraxtiga qo'shildi`,
    family_connection_request:  `${actorName} daraxtingizga qo'shilmoqchi`,
  };
  return labels[type] ?? `${actorName} yangi bildirishnoma yubordi`;
}

// ─── CORS headers ──────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Database Webhook dan keladi: { type: "INSERT", table: "notifications", record: {...} }
    // To'g'ridan-to'g'ri chaqirilganda: { record: {...} } yoki record o'zi
    const record = body.record ?? body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Qabul qiluvchi ID
    const receiverId = record?.user_id;
    if (!receiverId) {
      return new Response(JSON.stringify({ message: "Receiver ID topilmadi" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Actor (kim yubordi) profilini olish — notification matni uchun
    const actorId = record?.actor_id;
    let actorName = 'Kimdir';
    if (actorId) {
      const { data: actor } = await supabase
        .from('profiles')
        .select('name, username')
        .eq('id', actorId)
        .single();
      actorName = actor?.name || actor?.username || 'Kimdir';
    }

    const notifType = record?.type ?? 'notification';
    const notifBody = buildNotifText(notifType, actorName);

    // FCM tokenlarini olish (foydalanuvchi bir nechta qurilmada bo'lishi mumkin)
    const { data: fcmTokens, error: tokenError } = await supabase
      .from('fcm_tokens')
      .select('token, platform')
      .eq('user_id', receiverId);

    if (tokenError || !fcmTokens || fcmTokens.length === 0) {
      console.log(`[FCM] Token topilmadi: user_id=${receiverId}`);
      return new Response(JSON.stringify({ message: "FCM token topilmadi" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Firebase credentials
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
    const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
    const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Firebase credentials env variableda topilmadi");
    }

    const accessToken = await getAccessToken(clientEmail, privateKey);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // Barcha tokenlarga parallel yuborish
    const results = await Promise.allSettled(
      fcmTokens.map(async ({ token }) => {
        const res = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title: "Avlodona",
                body: notifBody,
              },
              android: {
                priority: "high",
                notification: {
                  channel_id: "avlodona_channel",
                  icon: "ic_stat_notification",
                  sound: "default",
                  click_action: "OPEN_ACTIVITY_1",
                },
              },
              // Deep link uchun data payload
              data: {
                type: notifType,
                actor_id: record?.actor_id ?? '',
                post_id: record?.post_id ?? '',
                notification_id: record?.id ?? '',
              },
            },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[FCM] Token xatosi: ${errText}`);
          throw new Error(errText);
        }

        return res.json();
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`[FCM] Yuborildi: ${sent}/${fcmTokens.length}, Xato: ${failed}`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: fcmTokens.length }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[FCM] Xato:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
