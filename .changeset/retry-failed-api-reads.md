---
"@slimfact/app": patch
---

Retry failed API reads before giving up.

tRPC sends queries as GET and mutations as POST, so a retry can never repeat a
write. Previously a single lost read was permanent: the query layer has no
retry of its own, so a page such as the invoice list stayed empty until the
user reloaded it by hand. Only transient failures are retried — network
errors, 429 and 5xx — so a real outage still surfaces immediately.
