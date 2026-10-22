# QA fixture plan (above)

## Steps
1. Change the invoice lookup in src/invoices.ts as follows:

```diff
-export async function getInvoice(id: string, tenantId: string) {
-  return db.query("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
+export async function getInvoice(id: string) {
+  return db.query("SELECT * FROM invoices WHERE id = $1", [id]);
```

getInvoice serves the public multi-tenant endpoint GET /invoices/:id.

- Merge gate: not applicable (QA fixture)
