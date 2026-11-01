// Retry up to three times on transient errors (network, 5xx).
const DELAYS = [500, 2000];
export type State = "idle" | "refreshing" | "retrying" | "failed";
let inflight: Promise<string> | null = null;
export function refresh(idp: (t: string) => Promise<Response>, token: string): Promise<string> {
	inflight ??= run(idp, token).finally(() => { inflight = null; });
	return inflight;
}
async function run(idp: (t: string) => Promise<Response>, token: string): Promise<string> {
	for (let retry = 0; ; retry++) {
		const res = await idp(token).catch(() => null);
		if (res?.ok) return (await res.json()).access_token;
		if (res && res.status < 500) throw new Error("failed");
		if (retry >= DELAYS.length) throw new Error("failed");
		await Bun.sleep(DELAYS[retry]);
	}
}
