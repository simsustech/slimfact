---
'@slimfact/api': patch
---

Restart recurring invoices after a restart. Since subscription queues were
renamed to `subscription.<uuid>`, `initialize` still looked for schedules named
`subscription:`, matched none, and registered no worker at boot. After any
restart or deploy, scheduled runs kept queueing but no invoice was created
until the subscription was stopped and started again, and pg-boss drops a
queued run after 14 days by default. `initialize` now registers a worker for
every `subscription.` schedule and awaits each registration.
