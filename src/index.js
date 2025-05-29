export default {
  async fetch(request, env, ctx) {
    const response = await fetch(request);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    let html = await response.text();

    const esiIncludeRegex = /<esi:include\s+src=["']([^"']+)["']\s*\/?>/gi;
    const matches = [...html.matchAll(esiIncludeRegex)];

    const headersToForward = [
      "cookie"
    ];

    const fetchPromises = matches.map(async (match) => {
      const tag = match[0];
      const src = match[1];
      try {
        const esiUrl = new URL(src, request.url);

        // Extract and forward session-related headers
        const forwardedHeaders = new Headers();
        for (const name of headersToForward) {
          const value = request.headers.get(name);
          if (value) {
            forwardedHeaders.set(name, value);
          }
        }

        const esiResp = await fetch(esiUrl.toString(), {
          method: "GET",
          headers: forwardedHeaders,
        });

        const esiContent = await esiResp.text();
        return { tag, content: esiContent };
      } catch (e) {
        console.error(`ESI fetch failed for ${src}:`, e);
        return { tag, content: `<!-- ESI include failed: ${src} -->` };
      }
    });

    const results = await Promise.all(fetchPromises);

    for (const { tag, content } of results) {
      html = html.replace(tag, content);
    }

    return new Response(html, {
      status: response.status,
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    });
  },
};
