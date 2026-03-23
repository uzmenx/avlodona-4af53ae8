import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const strip = (val: string, key: string) => {
      let v = val.trim();
      if (v.startsWith(`${key}=`)) v = v.slice(key.length + 1).trim();
      return v;
    };
    const R2_ACCESS_KEY_ID = strip(Deno.env.get("R2_ACCESS_KEY_ID") ?? "", "R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = strip(Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "", "R2_SECRET_ACCESS_KEY");
    const R2_ENDPOINT = strip(Deno.env.get("R2_ENDPOINT") ?? "", "R2_ENDPOINT");
    const R2_BUCKET_NAME = strip(Deno.env.get("R2_BUCKET_NAME") ?? "", "R2_BUCKET_NAME");
    const R2_PUBLIC_URL = strip(Deno.env.get("R2_PUBLIC_URL") ?? "", "R2_PUBLIC_URL");

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME) {
      console.error("Missing R2 env vars");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing R2 credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "upload") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const path = formData.get("path") as string;

      if (!file || !path) {
        return new Response(
          JSON.stringify({ error: "file and path required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const body = new Uint8Array(arrayBuffer);

      console.log(`Uploading: key=${path}, size=${body.length}, type=${file.type}`);

      // Authenticate and Check limits via Supabase
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
      );

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

      if (!userError && user) {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: usageData } = await supabaseAdmin
          .from("user_usage")
          .select("total_storage_bytes")
          .eq("user_id", user.id)
          .single();

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .single();

        const currentStorage = usageData?.total_storage_bytes || 0;
        const tier = profile?.subscription_tier || 'free';
        
        const FREE_LIMIT = 200 * 1024 * 1024; // 200MB
        const PRO_LIMIT = 2 * 1024 * 1024 * 1024; // 2GB

        const limit = tier === 'pro' ? PRO_LIMIT : FREE_LIMIT;
        
        if (currentStorage + body.length > limit) {
          return new Response(
            JSON.stringify({ 
              error: `Xotira hajmi yetarli emas (${tier} plan uchu ${tier === 'pro' ? '2GB' : '200MB'} limit)`,
              limit_reached: true 
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // We will update the storage afterwards
      }

      // Use aws4fetch for lightweight AWS v4 signing
      const { AwsClient } = await import("https://esm.sh/aws4fetch@1.0.20");
      
      const client = new AwsClient({
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
        region: "auto",
        service: "s3",
      });

      const putUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${path}`;
      
      const response = await client.fetch(putUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Content-Length": String(body.length),
        },
        body: body,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("R2 PUT failed:", response.status, errText);
        throw new Error(`R2 upload failed: ${response.status} - ${errText}`);
      }

      const publicUrl = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/${path}`
        : `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${path}`;

      console.log("Upload success:", publicUrl);

      // Update the user usage storage
      if (user) {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        
        // Let's do a fast update via a simple RPC or just fetching and updating since we are inside Edge Function
        const { data: usageData } = await supabaseAdmin
          .from("user_usage")
          .select("total_storage_bytes")
          .eq("user_id", user.id)
          .single();
          
        const currentStorage = usageData?.total_storage_bytes || 0;
        
        await supabaseAdmin
          .from("user_usage")
          .update({ total_storage_bytes: currentStorage + body.length })
          .eq("user_id", user.id);
      }

      return new Response(
        JSON.stringify({ url: publicUrl, path }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use ?action=upload" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Upload failed";
    console.error("R2 upload error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
