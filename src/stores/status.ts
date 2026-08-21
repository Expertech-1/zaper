/**
 * Async status shared by the data stores.
 *
 * Modelled as one discriminated value rather than a set of booleans, so
 * "loading and errored" cannot be represented (spec §32).
 */
export type LoadStatus = "idle" | "loading" | "ready" | "error";
