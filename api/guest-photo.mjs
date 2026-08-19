const SUPABASE_MEDIA_BASE = "https://kyrcukwbodzcuqkpihuf.supabase.co/storage/v1/object/public/podcast-media/";

const allowedName = value => /^[a-zA-Z0-9._-]{1,180}\.(?:png|jpe?g|webp)$/i.test(String(value || ""));

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET, HEAD");
    return response.end();
  }

  const url = new URL(request.url || "/", "http://localhost");
  const name = String(url.searchParams.get("name") || "").trim();
  if (!allowedName(name)) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    return response.end("Imagem inválida");
  }

  try {
    const upstream = await fetch(`${SUPABASE_MEDIA_BASE}${encodeURIComponent(name)}`, {
      headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      response.statusCode = upstream.status === 404 ? 404 : 502;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      return response.end("Imagem indisponível");
    }

    const type = upstream.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) {
      response.statusCode = 502;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      return response.end("Resposta de imagem inválida");
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    response.statusCode = 200;
    response.setHeader("Content-Type", type);
    response.setHeader("Content-Length", String(body.length));
    response.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (request.method === "HEAD") return response.end();
    return response.end(body);
  } catch {
    response.statusCode = 502;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    return response.end("Não foi possível carregar a foto");
  }
}
