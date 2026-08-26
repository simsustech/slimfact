// The proxy now shares the `slimfact` database with the SlimFact api (the
// postgres image creates it at first boot), so there is no database to
// bootstrap anymore. All proxy objects live under the `open_banking` schema,
// created by the migrations. This file is kept as a no-op so nothing that
// still references it breaks; the container entry no longer calls it.
export {};
