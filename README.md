# graphql-fragment-argument-linter

A [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) plugin that validates the usage of `@argumentDefinitions` and `@arguments` directives on fragments.

## Overview

This plugin enforces a convention where fragments declare their variables explicitly via `@argumentDefinitions`, and callers pass them via `@arguments`. This makes fragment dependencies self-contained and statically verifiable.

```graphql
fragment UserCard on User @argumentDefinitions(userId: { type: "ID!" }) {
  friend(id: $userId) { id name }
}

query GetUser($userId: ID!) {
  user(id: $userId) {
    ...UserCard @arguments(userId: $userId)  # ✅ explicit and type-safe
  }
}
```

If a violation is found, the plugin throws an error and fails the codegen process.

## Installation

```bash
npm install --save-dev graphql-fragment-argument-linter
# or
pnpm add -D graphql-fragment-argument-linter
```

## Setup

Add the plugin to your `codegen.ts`. It can run alongside other plugins:

```typescript
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './schema.graphql',
  documents: ['./src/**/*.graphql'],
  generates: {
    './generated/types.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'graphql-fragment-argument-linter',
      ],
    },
  },
};

export default config;
```

## Directives

| Directive | Target | Role |
|-----------|--------|------|
| `@argumentDefinitions` | Fragment definition | Declares the variables a fragment accepts |
| `@arguments` | Fragment spread | Passes variables to a fragment |

These directives are build-time only and do not appear in the runtime GraphQL schema.

## Validation Rules

### Rule 1 — `@argumentDefinitions` syntax

Each argument must follow the form `argName: { type: "GraphQLType" }`.

```graphql
# ✅ OK
fragment F on User @argumentDefinitions(userId: { type: "ID!" }) { ... }

# ❌ ERROR: missing type field
fragment F on User @argumentDefinitions(userId: { foo: "bar" }) { ... }

# ❌ ERROR: invalid GraphQL type string
fragment F on User @argumentDefinitions(userId: { type: "!!!" }) { ... }
```

### Rule 2 — `@arguments` syntax

Argument values must be variable references. Literals are not allowed.

```graphql
# ✅ OK
...UserCard @arguments(userId: $userId)

# ❌ ERROR: literal value
...UserCard @arguments(userId: "123")
```

### Rule 3 — `@arguments` is required

A fragment spread must include `@arguments` when the fragment defines `@argumentDefinitions`.

```graphql
# ✅ OK
...UserCard @arguments(userId: $userId)

# ❌ ERROR
...UserCard
```

### Rule 4 — `@arguments` is forbidden

A fragment spread must not include `@arguments` when the fragment does not define `@argumentDefinitions`.

```graphql
fragment Simple on User { id }

# ✅ OK
...Simple

# ❌ ERROR
...Simple @arguments(userId: $userId)
```

### Rule 5 — Argument names must match

The argument names in `@arguments` must exactly match those declared in `@argumentDefinitions` — no extra, no missing.

```graphql
fragment F on User @argumentDefinitions(userId: { type: "ID!" }, role: { type: "String!" }) { ... }

# ✅ OK
...F @arguments(userId: $userId, role: $role)

# ❌ ERROR: "unknown" is not declared
...F @arguments(userId: $userId, unknown: $x)

# ❌ ERROR: "role" is missing
...F @arguments(userId: $userId)
```

### Rule 6 — Argument types must be compatible

The type of each variable passed via `@arguments` must be compatible with the type declared in `@argumentDefinitions`.

| Variable type | Declared type | Result |
|--------------|--------------|--------|
| `T!` | `T!` | ✅ exact match |
| `T!` | `T` | ✅ non-nullable is assignable to nullable |
| `T` | `T!` | ❌ nullable is not assignable to non-nullable |
| `T` | `T` | ✅ exact match |

```graphql
fragment F on User @argumentDefinitions(userId: { type: "ID!" }) { ... }

# ✅ OK: ID! → ID!
query Q($userId: ID!) { ...F @arguments(userId: $userId) }

# ❌ ERROR: ID → ID!
query Q($userId: ID) { ...F @arguments(userId: $userId) }
```

### Rule 7 — Variable declaration and usage must match

In a fragment with `@argumentDefinitions`, the set of declared arguments and the set of variables used in the fragment body must be identical.

```graphql
# ✅ OK
fragment F on User @argumentDefinitions(userId: { type: "ID!" }) {
  friend(id: $userId) { id }
}

# ❌ ERROR: $userId is used but not declared
fragment F on User @argumentDefinitions(role: { type: "String!" }) {
  friend(id: $userId) { id }
}

# ❌ ERROR: "role" is declared but never used
fragment F on User @argumentDefinitions(userId: { type: "ID!" }, role: { type: "String!" }) {
  friend(id: $userId) { id }
}
```

Fragments without `@argumentDefinitions` may use variables freely (standard GraphQL behavior — variables flow from the enclosing operation).

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
