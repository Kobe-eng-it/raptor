---
status: reviewed
source_commit: 44a8881444ca8cd77c368f53c5615ba2ea3147fb
last_generated: 2026-06-08T10:58:35.230Z
sources:
  - test/wiki.test.js
source_hashes:
  test/wiki.test.js: ae31ba76c61f049e
confidence: medium
---

# Routes

## Summary

Detected 6 route(s).

## Detected Routes

### .

- `GET /users` - [test/wiki.test.js](../../test/wiki.test.js):206 (express, high) - handler `createUser`; Express get route call
- `POST /users` - [test/wiki.test.js](../../test/wiki.test.js):207 (express, high) - handler `createUser`; Express post route call
- `DELETE /users/:id` - [test/wiki.test.js](../../test/wiki.test.js):211 (express, high) - handler unknown; Express delete route call
- `GET /users` - [test/wiki.test.js](../../test/wiki.test.js):233 (express, low) - handler unknown; Express get route call
- `GET /users` - [test/wiki.test.js](../../test/wiki.test.js):252 (express, high) - handler `list_users`; Express get route call
- `POST /users` - [test/wiki.test.js](../../test/wiki.test.js):256 (express, high) - handler `create_user`; Express post route call

## Build Warnings

- test/wiki.test.js:233 Express get route uses unresolved expression

## Related Pages

- [Architecture](architecture.md)
- [Symbols](symbols.md)
