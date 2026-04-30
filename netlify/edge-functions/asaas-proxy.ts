import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, access_token, x-env",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const asaasPath = url.pathname.replace("/api", "");

  // Pega o access_token do header — suporta tanto minúsculo quanto maiúsculo
  const apiKey =
    request.headers.get("access_token") ||
    request.headers.get("Access_token") ||
    request.headers.get("Access-Token") ||
    "";

  const env = request.headers.get("x-env") || "sandbox";

  const asaasBase =
    env === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

  const asaasUrl = `${asaasBase}${asaasPath}${url.search}`;

  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.text();

  try {
    const asaasResponse = await fetch(asaasUrl, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
        "User-Agent": "StaySplit/1.0",
      },
      body,
    });

    const text = await asaasResponse.text();

    return new Response(text, {
      status: asaasResponse.status,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ errors: [{ code: "proxy_error", description: String(err) }] }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const config = { path: "/api/*" };
