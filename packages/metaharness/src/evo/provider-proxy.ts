/**
 * Host-side provider proxy. The agent container authenticates to this proxy with a per-run token; the proxy swaps
 * the token for the real provider credential and forwards the request. The real credential therefore exists only
 * in the manager process: never in the agent environment, argv, a models file, or any persisted artifact.
 */
import * as crypto from "node:crypto";
import type { Server } from "bun";
import type { ProxyRoute } from "./proxy-models";

/** Headers an SDK may carry its credential in. The token is replaced in whichever one it arrived in. */
const AUTH_HEADERS = ["authorization", "x-api-key", "api-key", "x-goog-api-key"] as const;
/** Hop-by-hop / re-derived headers never copied to the upstream request. */
const DROP_REQUEST = new Set(["host", "connection", "content-length", "accept-encoding", "transfer-encoding"]);
/** Response headers invalidated by fetch having already decoded the body. */
const DROP_RESPONSE = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

interface Registration {
	jobName: string;
	routes: ReadonlyMap<string, ProxyRoute>;
}

/** Authenticated liveness path: 204 for a registered token, 401 otherwise. Never forwarded upstream. */
export const LIVENESS_PATH = "/_omp/liveness";

/**
 * Host-side probe of a proxy at `http://127.0.0.1:<port>` with the run's own token. True only on 204: a dead port,
 * a revoked token, or any other answer means the agent's provider route is gone.
 */
export async function probeProxyLiveness(port: number | string, token: string, timeoutMs = 5000): Promise<boolean> {
	try {
		const response = await fetch(`http://127.0.0.1:${port}${LIVENESS_PATH}`, {
			headers: { authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(timeoutMs),
		});
		return response.status === 204;
	} catch {
		return false;
	}
}

export class ProviderProxy {
	#server: Server<undefined> | null = null;
	readonly #byToken = new Map<string, Registration>();
	readonly #fetch: typeof fetch;

	constructor(upstreamFetch: typeof fetch = fetch) {
		this.#fetch = upstreamFetch;
	}

	/** Bound port; starts the listener on first use. Every interface: containers reach the host over a bridge. */
	get port(): number {
		this.#server ??= Bun.serve({
			hostname: "0.0.0.0",
			port: 0,
			idleTimeout: 0,
			fetch: request => this.#handle(request),
		});
		return this.#server.port as number;
	}

	/** Mint a fresh token valid for `routes`; any earlier token of the same job is revoked. */
	register(jobName: string, routes: ReadonlyMap<string, ProxyRoute>): string {
		this.unregister(jobName);
		const token = `omp-evo-${crypto.randomBytes(32).toString("hex")}`;
		this.#byToken.set(token, { jobName, routes });
		return token;
	}

	unregister(jobName: string): void {
		for (const [token, entry] of this.#byToken) if (entry.jobName === jobName) this.#byToken.delete(token);
	}

	stop(): void {
		this.#server?.stop(true);
		this.#server = null;
		this.#byToken.clear();
	}

	async #handle(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === LIVENESS_PATH) return this.#liveness(request);
		const outgoing = new Headers();
		for (const [name, value] of request.headers) if (!DROP_REQUEST.has(name)) outgoing.set(name, value);
		let registration: Registration | undefined;
		for (const name of AUTH_HEADERS) {
			const raw = request.headers.get(name);
			if (raw === null) continue;
			const bare = raw.replace(/^Bearer\s+/i, "");
			const found = this.#byToken.get(bare);
			if (!found) continue;
			registration = found;
			const route = this.#routeFor(url, found);
			if (!route) break;
			// Same header, same shape (`Bearer <t>` or bare): only the secret changes.
			if (route.apiKey !== undefined)
				outgoing.set(name, raw.startsWith(bare) ? route.apiKey : `Bearer ${route.apiKey}`);
			else outgoing.delete(name);
			break;
		}
		if (!registration) return new Response("unauthorized", { status: 401 });
		const route = this.#routeFor(url, registration);
		if (!route) return new Response("unknown provider", { status: 404 });
		for (const [name, value] of Object.entries(route.headers)) outgoing.set(name, value);
		const rest = url.pathname.split("/").slice(2).join("/");
		const target = `${route.upstream.replace(/\/+$/, "")}/${rest}${url.search}`;
		const upstream = await this.#fetch(target, {
			method: request.method,
			headers: outgoing,
			body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
			redirect: "manual",
		}).catch(() => null);
		if (!upstream) return new Response("upstream unreachable", { status: 502 });
		const headers = new Headers();
		for (const [name, value] of upstream.headers) if (!DROP_RESPONSE.has(name)) headers.set(name, value);
		return new Response(upstream.body, { status: upstream.status, headers });
	}

	#liveness(request: Request): Response {
		for (const name of AUTH_HEADERS) {
			const raw = request.headers.get(name);
			if (raw !== null && this.#byToken.has(raw.replace(/^Bearer\s+/i, "")))
				return new Response(null, { status: 204 });
		}
		return new Response(null, { status: 401 });
	}

	#routeFor(url: URL, registration: Registration): ProxyRoute | undefined {
		const provider = decodeURIComponent(url.pathname.split("/")[1] ?? "");
		return registration.routes.get(provider);
	}
}
