---
status: reviewed
source_commit: 94212e79699cdc713a3de7b7284afffffd4bddfa
last_generated: 2026-06-10T09:22:48.623Z
sources:
  - test/wiki.test.js
source_hashes:
  test/wiki.test.js: a9a0ca76fce6ec1e
confidence: medium
---

# Routes

## Summary

Detected 6 route(s).

## Detected Routes

### .

- `GET /users` - [test/wiki.test.js](../../test/wiki.test.js):235 (express, high) - handler `createUser`; Express get route call
- `POST /users` - [test/wiki.test.js](../../test/wiki.test.js):236 (express, high) - handler `createUser`; Express post route call
- `DELETE /users/:id` - [test/wiki.test.js](../../test/wiki.test.js):240 (express, high) - handler unknown; Express delete route call
- `GET /users` - [test/wiki.test.js](../../test/wiki.test.js):262 (express, low) - handler unknown; Express get route call
- `GET /users` - [test/wiki.test.js](../../test/wiki.test.js):281 (express, high) - handler `list_users`; Express get route call
- `POST /users` - [test/wiki.test.js](../../test/wiki.test.js):285 (express, high) - handler `create_user`; Express post route call

## Build Warnings

- test/wiki.test.js:262 Express get route uses unresolved expression

## Related Pages

- [Architecture](architecture.md)
- [Symbols](symbols.md)
