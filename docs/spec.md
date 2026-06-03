# GraphQL Fragment Argument Linter - Specification

## Overview

A GraphQL Codegen plugin that validates the usage of `@argumentDefinitions` and `@arguments` directives in GraphQL fragments.

## Configuration Options

### `requireArgumentDefinitions`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Require `@argumentDefinitions` directive on all fragments

## Validation Rules

### Rule 1: Fragment Definition Validation

When `requireArgumentDefinitions: true`, all fragments must have `@argumentDefinitions`.

```graphql
# ✅ OK
fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
  id
  name
}

# ❌ ERROR (when requireArgumentDefinitions: true)
fragment UserFields on User {
  id
  name
}
```

### Rule 2: Fragment Spread Validation

When a fragment definition has `@argumentDefinitions`, the spread must have `@arguments`.

```graphql
# Definition
fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
  id
  name
}

# ✅ OK
query GetUser($userId: ID!) {
  user(id: $userId) {
    ...UserFields @arguments(userId: $userId)
  }
}

# ❌ ERROR
query GetUser {
  user(id: "1") {
    ...UserFields  # Missing @arguments
  }
}
```

### Rule 3: Reverse Validation

When a fragment definition does not have `@argumentDefinitions`, the spread must not have `@arguments` (error if present).

```graphql
# Definition
fragment UserFields on User {
  id
  name
}

# ✅ OK
query GetUser {
  user(id: "1") {
    ...UserFields
  }
}

# ❌ ERROR
query GetUser {
  user(id: "1") {
    ...UserFields @arguments(userId: "1")  # Passing arguments that are not defined
  }
}
```
