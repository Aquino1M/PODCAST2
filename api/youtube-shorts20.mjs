let cache = { expires: 0, value: null };

const CHANNEL_URL = 'https://www.youtube.com/@Bebezaopodcast/shorts?hl=pt-BR&gl=BR';

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Método não permitido' });

  if (cache.value && cache.expires > Date.now()) {
    return sendJson(response, 200, cache.value);
  }

  try {
    const upstream = await fetch(CHANNEL_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
        'Cookie': 'CONSENT=YES+cb',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!upstream.ok) throw new Error(`YouTube respondeu ${upstream.status}`);

    const html = await upstream.text();
    const ids = [];
    const seen = new Set();
    const matcher = /\"videoId\":\"([A-Za-z0-9_-]{11})\"/g;
    let match;

    while ((match = matcher.exec(html)) && ids.length < 20) {
      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }

    if (ids.length < 6) throw new Error(`Foram encontrados somente ${ids.length} Shorts`);

    const value = {
      channel: '@Bebezaopodcast',
      source: 'youtube',
      total: ids.length,
      shorts: ids.map((id, index) => ({
        id,
        position: index + 1,
        url: `https://www.youtube.com/shorts/${id}`,
        embedUrl: `https://www.youtube.com/embed/${id}?rel=0&playsinline=1`,
      })),
      updatedAt: new Date().toISOString(),
    };

    cache = { expires: Date.now() + 10 * 60_000, value };
    return sendJson(response, 200, value);
  } catch (error) {
    if (cache.value) return sendJson(response, 200, cache.value);
    return sendJson(response, 502, {
      error: 'Não foi possível carregar os Shorts do Podcast do Bebezão.',
      detail: String(error?.message || error),
    });
  }
}
