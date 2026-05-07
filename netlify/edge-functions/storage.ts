import { getStore } from "@netlify/blobs";

export default async (request: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("_token") || "";
  const tipo = url.searchParams.get("tipo") || "";

  if (!token || !["hist", "hoteis"].includes(tipo)) {
    return new Response(
      JSON.stringify({ error: "Invalid params" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const id = token.replace(/[^a-zA-Z0-9]/g, "").slice(-16) || "default";
  const blobKey = `${tipo}_${id}`;
  const store = getStore("staysplit");

  if (request.method === "GET") {
    try {
      const data = await store.get(blobKey, { type: "json" });
      return new Response(
        JSON.stringify(data ?? null),
        { status: 200, headers: corsHeaders }
      );
    } catch {
      return new Response(
        JSON.stringify(null),
        { status: 200, headers: corsHeaders }
      );
    }
  }

  if (request.method === "POST") {
    try {
      const body = await request.json();
      await store.setJSON(blobKey, body);
      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: corsHeaders }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: String(err) }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: corsHeaders }
  );
};

export const config = { path: "/storage" };