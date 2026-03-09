import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Position {
  x: number;
  y: number;
}

interface MemberPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  relationType: string;
}

interface ConnectionRequest {
  members: MemberPosition[];
  hearts: { id: string; x: number; y: number; width: number; height: number }[];
  containerWidth: number;
  containerHeight: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { members, hearts, containerWidth, containerHeight }: ConnectionRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build AI prompt to calculate optimal line paths
    const systemPrompt = `You are an expert family tree visualization AI. Your task is to calculate optimal SVG bezier curve paths to connect family members elegantly.

Rules for drawing lines:
1. Lines should be smooth and curved, never straight
2. Parent-to-child lines go from heart connector DOWN to child's top center
3. Child-to-parent lines go from member's top UP to parent heart
4. Lines can cross each other but should minimize crossings when possible
5. Use cubic bezier curves (C command) for elegant curves
6. Lines should curve around obstacles when possible
7. Maintain visual balance and symmetry

Return a JSON array of connection objects with SVG path data.`;

    const userPrompt = `Calculate optimal SVG bezier curve paths for these family tree connections:

Container size: ${containerWidth}x${containerHeight}

Members positions:
${members.map(m => `- ID: ${m.id}, Position: (${m.x}, ${m.y}), Size: ${m.width}x${m.height}, Relation: ${m.relationType}`).join('\n')}

Heart connectors:
${hearts.map(h => `- ID: ${h.id}, Position: (${h.x}, ${h.y}), Size: ${h.width}x${h.height}`).join('\n')}

For each connection needed, calculate an elegant curved SVG path. Consider:
1. Parent hearts connecting down to children
2. Children connecting up to parent hearts
3. Avoid overlapping with member cards when possible
4. Use smooth S-curves or simple curves based on distance

Return JSON format:
{
  "connections": [
    {
      "fromId": "string",
      "toId": "string",
      "type": "parent" | "child",
      "path": "M x y C cx1 cy1, cx2 cy2, ex ey",
      "reasoning": "brief explanation"
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "calculate_paths",
              description: "Return calculated SVG paths for family tree connections",
              parameters: {
                type: "object",
                properties: {
                  connections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        fromId: { type: "string" },
                        toId: { type: "string" },
                        type: { type: "string", enum: ["parent", "child", "spouse"] },
                        path: { type: "string", description: "SVG path d attribute" },
                        controlPoints: {
                          type: "object",
                          properties: {
                            cx1: { type: "number" },
                            cy1: { type: "number" },
                            cx2: { type: "number" },
                            cy2: { type: "number" },
                          },
                        },
                      },
                      required: ["fromId", "toId", "type", "path"],
                    },
                  },
                },
                required: ["connections"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "calculate_paths" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback - return empty connections
    return new Response(JSON.stringify({ connections: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error calculating family lines:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
