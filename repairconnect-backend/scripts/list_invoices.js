import sql from '../db.js';

(async function(){
  try {
    const rows = await sql`SELECT id, service_request_id, provider_id, customer_id, amount, currency, paid, created_at FROM invoices ORDER BY created_at DESC LIMIT 50`;
    console.log('found', rows.length, 'invoices');
    for (const r of rows) {
      console.log(r);
    }
    process.exit(0);
  } catch (err) {
    console.error('Failed to list invoices:', err);
    process.exit(2);
  }
})();
