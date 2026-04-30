import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  // Headers CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, access_token, x-env",
    "Content-Type": "application/json",
  };

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // Remove /api do path para montar URL do Asaas
  const asaasPath = url.pathname.replace("/api", "");
  const apiKey = request.headers.get("access_token") || "";
  const env = request.headers.get("x-env") || "sandbox";

  const asaasHost =
    env === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

  const asaasUrl = `${asaasHost}${asaasPath}${url.search}`;

  // Monta headers para o Asaas
  const asaasHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "access_token": apiKey,
    "User-Agent": "StaySplit/1.0",
  };

  // Repassa a requisição para o Asaas
  const body = request.method !== "GET" ? await request.text() : undefined;

  try {
    const asaasResponse = await fetch(asaasUrl, {
      method: request.method,
      headers: asaasHeaders,
      body,
    });

    const responseText = await asaasResponse.text();

    return new Response(responseText, {
      status: asaasResponse.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        errors: [{ code: "proxy_error", description: String(error) }],
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const config = { path: "/api/*" };
