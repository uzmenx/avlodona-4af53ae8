import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { receiver_id } = await req.json()

    if (!receiver_id) {
      return new Response(
        JSON.stringify({ error: 'Receiver ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY')
    
    if (!DAILY_API_KEY) {
      console.error('Daily API key not configured')
      return new Response(
        JSON.stringify({ error: 'Daily API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Daily room with proper settings
    const roomName = `call-${user.id.slice(0, 8)}-${receiver_id.slice(0, 8)}-${Date.now()}`
    
    console.log('Creating Daily room:', roomName)
    
    const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: {
          max_participants: 2,
          exp: Math.floor(Date.now() / 1000) + (20 * 60), // 20 minutes expiration
          enable_prejoin_ui: false,
          enable_knocking: false,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    })

    if (!dailyResponse.ok) {
      const errorText = await dailyResponse.text()
      console.error('Daily API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to create room', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const roomData = await dailyResponse.json()
    console.log('Daily room created:', roomData.url)

    // Save call record to Supabase using service role for insert
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: callData, error: insertError } = await supabaseAdmin
      .from('calls')
      .insert({
        caller_id: user.id,
        receiver_id: receiver_id,
        room_url: roomData.url,
        room_name: roomName,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error saving call:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save call record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Call record saved:', callData.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        call: callData,
        room_url: roomData.url,
        room_name: roomName 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
