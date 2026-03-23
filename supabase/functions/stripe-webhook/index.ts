import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.18.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Some basic CORS handling just in case, though webhook doesn't typically need it
    return new Response(null, { headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature || !webhookSecret) {
    return new Response("Webhook secret and signature are required.", {
      status: 400,
    });
  }

  try {
    const body = await req.text();
    let event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      const e = err as Error;
      console.error(`Webhook signature verification failed: ${e.message}`);
      return new Response(`Webhook Error: ${e.message}`, { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle the event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const userId = session.client_reference_id || session.metadata?.userId;
      const subscriptionId = session.subscription;
      const customerId = session.customer;

      if (userId) {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_tier: "pro",
            stripe_customer_id: customerId as string,
            stripe_subscription_id: subscriptionId as string,
          })
          .eq("id", userId);

        if (error) {
          console.error("Failed to update user subscription tier", error);
        } else {
          console.log(`Successfully upgraded user ${userId} to pro.`);
        }
      }
    } else if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.canceled") {
      const subscription = event.data.object as any;
      const customerId = subscription.customer;

      if (customerId) {
        const { data, error: findError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (data?.id) {
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              subscription_tier: "free",
              stripe_subscription_id: null,
            })
            .eq("id", data.id);
            
          if (error) {
            console.error("Failed to downgrade user", error);
          } else {
            console.log(`Successfully downgraded user ${data.id} to free.`);
          }
        } else if (findError) {
           console.error("Error finding user by customer id", findError);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const e = err as Error;
    console.error(`Unhandled webhook error: ${e.message}`);
    return new Response("Internal Server Error", { status: 500 });
  }
});
