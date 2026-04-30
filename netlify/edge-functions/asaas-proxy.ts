export default async (request: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const asaasPath = url.pathname.replace("/api", "");

    // Lê o body uma vez
    const bodyText = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.text();

    // Tenta pegar o access_token de múltiplas fontes
    let apiKey = "";

    // 1. Do header direto
    for (const [key, value] of request.headers.entries()) {
      if (key.toLowerCase() === "access_token") {
        apiKey = value;
        break;
      }
    }

    // 2. Do body JSON se não encontrou no header
    if (!apiKey && bodyText) {
      try {
        const bodyJson = JSON.parse(bodyText);
        if (bodyJson._apiKey) {
          apiKey = bodyJson._apiKey;
          delete bodyJson._apiKey;
        }
      } catch {}
    }

    const env = request.headers.get("x-env") || "sandbox";
    const asaasBase = env === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    const asaasUrl = `${asaasBase}${asaasPath}${url.search}`;

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
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ errors: [{ code: "proxy_error", description: String(err) }] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

export const config = { path: "/api/*" };
