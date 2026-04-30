export default async (request: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const asaasPath = url.pathname.replace("/api", "");

    // Pega apiKey e env dos query params (passados pelo frontend)
    const apiKey = url.searchParams.get("_token") || "";
    const env = url.searchParams.get("_env") || "sandbox";

    // Remove os params internos antes de repassar
    url.searchParams.delete("_token");
    url.searchParams.delete("_env");

    const asaasBase = env === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    const asaasUrl = `${asaasBase}${asaasPath}${url.search ? url.search : ""}`;

    const bodyText = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.text();

    const asaasResponse = await fetch(asaasUrl, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
        "User-Agent": "StaySplit/1.0",
      },
      body: bodyText,
    });

    const responseText = await asaasResponse.text();

    return new Response(responseText, {
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
