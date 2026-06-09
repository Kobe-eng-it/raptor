---
status: reviewed
source_commit: 652c4c920c9d0be90dbdb47434b5e211260e1ac7
last_generated: 2026-06-09T07:28:49.715Z
sources:
  - test/wiki.test.js
source_hashes:
  test/wiki.test.js: d4319c3b2dfbe863
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
