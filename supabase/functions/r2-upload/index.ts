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
