export default {
  async fetch(request, env, ctx) {
    const response = await fetch(request);

    // Only process HTML responses
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    let html = await response.text();

    // Match all <esi:include src="..."/>
    const esiIncludeRegex = /<esi:include\s+src=["']([^"']+)["']\s*\/?>/gi;
    const matches = [...html.matchAll(esiIncludeRegex)];

    // Create a list of promises to fetch each include
    const fetchPromises = matches.map(async (match) => {
      const tag = match[0];
      const src = match[1];
      try {
        const esiUrl = new URL(src, request.url);
        const esiResp = await fetch(esiUrl.toString());
        const esiContent = await esiResp.text();
        return { tag, content: esiContent };
      } catch (e) {
        console.error(`ESI fetch failed for ${src}:`, e);
        return { tag, content: `<!-- ESI include failed: ${src} -->` };
      }
    });

    // Wait for all includes to be fetched
    const results = await Promise.all(fetchPromises);

    // Replace each ESI tag in HTML with the fetched content
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
