export async function refreshSession(s: { refreshToken: string }, idp: (t: string) => Promise<string>) {
	try {
		return await idp(s.refreshToken);
	} catch {
		throw new Error("signed out");
	}
}
