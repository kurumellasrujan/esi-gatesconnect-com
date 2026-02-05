export default {
  async fetch(request, env, ctx) {
    const response = await fetch(request);

    // Check if the origin server sent a 301 redirect
    if (response.status === 301 || response.status === 302) {
      const location = response.headers.get("Location");
      if (location) {
        return Response.redirect(location, 301);
      }
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    let html = await response.text();

    //const esiIncludeRegex = /<esi:include\s+src=["']([^"']+)["']\s*\/?>/gi;
    const esiIncludeRegex = /<esi:include src="([^"]+)"\s*\/?>/g;
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

    // Copy all headers from Origin
    const newHeaders = new Headers(response.headers)

    // Ensure correct content type (origin might already have it, but we overwrite)
    newHeaders.set("content-type", "text/html;charset=UTF-8");

    // Return HTML with all origin headers preserved
    return new Response(html, {
      status: response.status,
      headers: newHeaders,
    });
  },
};
