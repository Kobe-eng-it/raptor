---
status: reviewed
source_commit: 17e8ea2fc390604d42a1f4babaff374017cb9755
last_generated: 2026-06-08T14:09:10.024Z
sources:
  - test/wiki.test.js
source_hashes:
  test/wiki.test.js: 64edc43aa78f2ca7
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
