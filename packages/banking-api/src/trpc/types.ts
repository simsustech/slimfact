import type { createAppRouter } from "./machine.js";

/** Router type shared with machine clients (e.g. SlimFact). */
export type AppRouter = ReturnType<typeof createAppRouter>;
