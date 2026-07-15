# Auth

Use **Convex Auth** (`@convex-dev/auth`) with the Password provider for email + password,
or add OAuth providers as needed. Do not hand-roll password hashing.

- Install: `npm i @convex-dev/auth` and follow the Convex Auth setup (adds `auth.config.ts`
  and wires `ctx.auth`).
- The `users`/`sessions` tables in `schema.ts` mirror profile + address data; Convex Auth
  manages its own identity tables alongside.
- Gate account queries/mutations on `const identity = await ctx.auth.getUserIdentity()`.
- Guest checkout must remain possible: `orders.createOrder` accepts an optional `userId`.

This file is a placeholder marker — implement with the official Convex Auth quickstart rather
than custom session logic.
