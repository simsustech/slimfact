/**
 * Barrel export for the banking module in @slimfact/tools.
 *
 * Per ADR-0006 all framework-free banking logic (matching, suggestion,
 * reference normalization, money parsing) lives here; the api and banking-api
 * are data+writes callers, the app imports the wire types.
 */
export * from './types.js'
export * from './normalize.js'
export * from './money.js'
export * from './client.js'
export * from './match.js'
export * from './suggest.js'
