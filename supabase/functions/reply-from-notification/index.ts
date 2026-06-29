// reply-from-notification: bildirishnomadan to'g'ridan-to'g'ri javob yozish uchun.
// JWT bilan autentifikatsiya qilingan foydalanuvchi nomidan messages ga insert qiladi.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const recipientId: string | undefined = body.recipient_id;
    const conversationIdInput: string | undefined = body.conversation_id;
    const content: string = (body.content ?? '').toString().trim();

    if (!content || content.length > 4000) {
      return new Response(JSON.stringify({ error: 'Bo\'sh yoki juda uzun xabar' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!recipientId && !conversationIdInput) {
      return new Response(JSON.stringify({ error: 'recipient_id yoki conversation_id kerak' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role bilan conversation topish/yaratish
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let conversationId = conversationIdInput;

    if (!conversationId && recipientId) {
      // Mavjud conversation ni topish
      const { data: existing } = await admin
        .from('conversations')
        .select('id, participant1_id, participant2_id')
        .or(
          `and(participant1_id.eq.${userId},participant2_id.eq.${recipientId}),` +
          `and(participant1_id.eq.${recipientId},participant2_id.eq.${userId})`
        )
        .maybeSingle();

      if (existing) {
        conversationId = existing.id;
      } else {
        const { data: created, error: createErr } = await admin
          .from('conversations')
          .insert({ participant1_id: userId, participant2_id: recipientId })
          .select('id')
          .single();
        if (createErr || !created) {
          return new Response(JSON.stringify({ error: createErr?.message ?? 'Conversation yaratib bo\'lmadi' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        conversationId = created.id;
      }
    } else {
      // Foydalanuvchi haqiqatan participant ekanligini tekshirish
      const { data: conv } = await admin
        .from('conversations')
        .select('participant1_id, participant2_id')
        .eq('id', conversationId!)
        .single();
      if (!conv || (conv.participant1_id !== userId && conv.participant2_id !== userId)) {
        return new Response(JSON.stringify({ error: 'Conversation\'ga ruxsat yo\'q' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Xabarni qo'shish (user JWT bilan — RLS o'tadi)
    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        status: 'sent',
      })
      .select('id, conversation_id, content, created_at')
      .single();

    if (msgErr) {
      return new Response(JSON.stringify({ error: msgErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: msg }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
