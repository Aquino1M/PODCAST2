const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36";

export default async function handler(request, response) {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    const id = String(url.searchParams.get("id") || "");
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
      response.statusCode = 400;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      return response.end("invalid id");
    }

    const candidates = [
      `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    ];

    for (const candidate of candidates) {
      try {
        const upstream = await fetch(candidate, {
          headers: {
            "User-Agent": USER_AGENT,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
          },
          signal: AbortSignal.timeout(8000),
        });
        const contentType = String(upstream.headers.get("content-type") || "");
        if (!upstream.ok || !contentType.startsWith("image/")) continue;

        const body = Buffer.from(await upstream.arrayBuffer());
        if (body.length < 1000) continue;

        response.statusCode = 200;
        response.setHeader("Content-Type", contentType);
        response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
        response.setHeader("X-Content-Type-Options", "nosniff");
        return response.end(body);
      } catch {}
    }

    response.statusCode = 404;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end("thumbnail unavailable");
  } catch {
    response.statusCode = 500;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end("thumbnail proxy failed");
  }
}
