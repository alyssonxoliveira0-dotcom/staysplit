// Stub: storage moved to netlify/functions/storage.js (Node.js, @netlify/blobs pre-bundled)
export default async (request: Request) => {
  const url = new URL(request.url);
  const target = new URL('/.netlify/functions/storage' + url.search, url.origin);
  return Response.redirect(target.toString(), 307);
};