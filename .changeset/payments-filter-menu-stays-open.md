---
"@slimfact/app": patch
---

Payments page: stop the filter menu closing itself. Two causes: the URL sync
(usePaymentsUrlState) wrote the URL on any filters change — including no-op
writes when the filter menu mounted — and QMenu's hideOnRouteChange then
closed the menu on the resulting route change. The sync now compares against
the URL's effective filters (fresh-view defaults included) so no-op writes
are skipped, and the filter menu is no-route-dismiss so selecting filters
keeps it open. Also fixed the round-trip so an absent source= param no longer
resets the sources filter to none (and no longer appends a stray source= to
the URL).
