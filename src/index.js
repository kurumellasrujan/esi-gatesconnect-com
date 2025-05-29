/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx) {
		//let url = new URL(request.url)
		//let response = await fetch("https://dev.gatesconnect.com/content/gatesconnect/us/en/ecommerce/home2.html")
		let response = await fetch(request)
		let contentType = response.headers.get("content-type") || ""
		if (!contentType.includes("text/html")) {
			return response
		}

		let html = await response.text()
		//console.log(html)
		// Find all <esi:include src="..."/> and collect their srcs
		let esiRegex = /<esi:include src="([^"]+)"\s*\/?>/g
		let matches = [...html.matchAll(esiRegex)]
		let fragmentPromises = matches.map(match => 
			fetch(new URL(match[1], request.url))
			.then(res => res.text())
			.catch(() => "")
		)

		// Fetch all fragments in parallel
		let fragments = await Promise.all(fragmentPromises)
		
		// Replace each ESI tag in the original HTML with fetched content
		let output = html
		matches.forEach((match, idx) => {
			output = output.replace(match[0], fragments[idx])
		})

		const newResponse = new Response(output, {
			headers: response.headers.set("Cache-Control", "max-age=0"),
			status: response.status
		})	

		//return new Response(output, {status: response.status, headers: response.headers })
		return newResponse
		
		//console.log(response.headers)
		
		//return new Response("Hello World!");
	},
};
