#!/usr/bin/env node
// match-bills-analysis.mjs — correlates dump bank CREDIT transactions to
// bills/receipts by fuzzy client name (fuse.js) + amount (+ description) + date
// guard, to demonstrate down-payment / partial-payment matching feasibility.
import pg from "pg";
import Fuse from "fuse.js";

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? "5433"),
  user: process.env.POSTGRES_USER ?? "postgres",
  password: process.env.POSTGRES_PASSWORD ?? "ufgouifdgjdfg",
  database: process.env.POSTGRES_DB ?? "slimfact_dump",
});

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
const tokens = (s) => norm(s).trim().split(/\s+/).filter(Boolean);
const booking = (t) => (t.booking_date || "").slice(0, 10);

const main = async () => {
  // 1. Bills/receipts (issued docs with a client contact + lines + effective date).
  const docs = (
    await pool.query(`
    SELECT id, status, total_including_tax, company_id,
           coalesce(client_details->>'contactPersonName','') AS contact,
           jsonb_path_query_array(lines,'$[*].description')::text AS descs,
           coalesce(date::text, split_part(created_at,' ',1)) AS doc_date
    FROM checkout.invoices
    WHERE status IN ('bill','receipt')
  `)
  ).rows;

  // 2. Fuzzy index over client contact names (ESM fuse.js).
  const fuse = new Fuse(docs, {
    keys: ["contact"],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
  });

  // 3. Credit transactions: client name from debtor_name or parsed from the
  //    Rabo Betaalverzoek remittance "IBAN:Client:Description:Contact".
  const tx = (
    await pool.query(`
    SELECT external_id, amount_cents, booking_date, debtor_name,
           remittance_information, note
    FROM open_banking.transactions WHERE credit_debit='CRDT'
  `)
  ).rows;

  const parseClient = (t) => {
    const ri = t.remittance_information || "";
    if (t.debtor_name && !/betaalverzoek|betaal verzoek/i.test(t.debtor_name))
      return { name: t.debtor_name, desc: t.note || "", contact: t.note || "" };
    const parts = ri.split(":");
    if (parts.length >= 3) {
      const desc = parts.slice(2).filter(Boolean).join(" ");
      const contact = parts.length >= 4 ? parts[3] : "";
      return { name: parts[1] || "", desc, contact };
    }
    return { name: ri, desc: "", contact: "" };
  };

  let total = 0;
  for (const t of tx) {
    const { name, desc, contact } = parseClient(t);
    if (!name) continue;
    // Fuse recall by client name (search both the parsed name and contact).
    const hits = fuse.search(contact || name);
    const cands = hits
      .map(({ item: d, score: fuseScore }) => {
        const ovContact = 1 - (fuseScore ?? 1); // higher = more similar
        const descHit =
          desc &&
          d.descs &&
          norm(desc) &&
          tokens(desc).some((tok) => tok.length > 3 && norm(d.descs).includes(tok));
        const amt = t.amount_cents;
        const exact = d.total_including_tax === amt;
        const partial = amt > 0 && amt <= d.total_including_tax && amt < d.total_including_tax;
        // date guard: a payment cannot precede its invoice's date
        const dateOk = !d.doc_date || booking(t) >= d.doc_date;
        const score = (exact ? 3 : partial ? 1 : 0) + (descHit ? 2 : 0) + ovContact * 4;
        return {
          d,
          score,
          exact,
          partial,
          descHit,
          dateOk,
          ovContact: +ovContact.toFixed(2),
        };
      })
      .filter((c) => c.score >= 2.5 && c.dateOk)
      .sort((a, b) => b.score - a.score);
    if (cands.length) {
      total++;
      if (total <= 25) {
        const c = cands[0];
        console.log(
          `€${(t.amount_cents / 100).toFixed(2)} ${booking(t)} "${(name || "").slice(0, 22)}" | ${(desc || "").slice(0, 28)} → #${c.d.id} ${c.d.status} €${(c.d.total_including_tax / 100).toFixed(2)} "${(c.d.contact || "").slice(0, 20)}" ${c.exact ? "EXACT" : c.partial ? "PARTIAL" : ""}${c.descHit ? " DESC" : ""} (score ${c.score.toFixed(1)})`,
        );
      }
    }
  }
  console.log(`\nTOTAL credits with ≥1 candidate bill/receipt: ${total} / ${tx.length}`);
  await pool.end();
};
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
