/** Functional regressions use local assets; external font/API waterfalls are audited separately. */
export async function isolateExternalRequests(context, baseURL) {
	const origin = new URL(baseURL).origin
	await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
}
