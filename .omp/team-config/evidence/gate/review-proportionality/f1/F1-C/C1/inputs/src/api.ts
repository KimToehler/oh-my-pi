export async function listInvoices(baseUrl: string, accessToken: string) {
	const res = await fetch(`${baseUrl}/v1/invoices`, { headers: { authorization: `Bearer ${accessToken}` } });
	if (!res.ok) throw new Error(`invoices: ${res.status}`);
	return res.json();
}
