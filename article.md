---
title: "GraphQL Codegenプラグインを作った話 — フラグメントの引数バリデーション"
emoji: "🔍"
type: "tech"
topics: ["graphql", "typescript", "graphqlcodegen", "linter"]
published: false
---

## はじめに

GraphQLのフラグメントは、変数をオペレーションのスコープから暗黙的に受け取る設計になっています。つまりフラグメントを見ただけでは、**何を渡さなければならないかがわかりません**。

関数であれば引数として明示するのが当たり前です。フラグメントでも同じように、受け取る値を明示的に宣言・伝達できれば、コードの見通しが良くなると感じました。

そこで `@argumentDefinitions` / `@arguments` というカスタムディレクティブを使った規約を設け、それを正しく使えているかをcodegen実行時に検証するプラグインを作りました。

---

## モチベーション：フラグメントの引数を明示したい

標準のGraphQLでは、フラグメントはオペレーションで宣言された変数をそのまま暗黙的に使えます。

```graphql
fragment UserCard on User {
  friend(id: $userId) { id name }
}

query GetUser($userId: ID!) {
  user(id: $userId) {
    ...UserCard   # $userId を暗黙的に使っているが、スプレッドを見ても分からない
  }
}
```

フラグメントが増えてネストが深くなると、**どのフラグメントがどの変数を必要としているかが不透明**になります。

`@argumentDefinitions` / `@arguments` を使うと、フラグメントの引数を関数のように明示できます。

```graphql
fragment UserCard on User @argumentDefinitions(userId: { type: "ID!" }) {
  friend(id: $userId) { id name }
}

query GetUser($userId: ID!) {
  user(id: $userId) {
    ...UserCard @arguments(userId: $userId)   # 何を渡しているかが一目でわかる
  }
}
```

ただしこれはカスタムディレクティブによる規約なので、誤った使い方をしてもcodegenは検出できません。このプラグインがその整合性を検証します。

---

## 作ったもの：graphql-codegen-fragment-argument-linter

[graphql-codegen-fragment-argument-linter](https://www.npmjs.com/package/graphql-codegen-fragment-argument-linter)

GraphQL Code Generatorのプラグインとして動作し、**codegen実行時に上記のようなミスをまとめて検出**します。問題があればエラーを投げてcodegenを失敗させるため、CIで確実にキャッチできます。

### 検証ルール一覧

| # | ルール | 内容 |
|---|--------|------|
| 1 | `@argumentDefinitions` の構文 | `argName: { type: "GraphQLType" }` 形式かどうか |
| 2 | `@arguments` の構文 | 値が変数参照（`$var`）かどうか（リテラル禁止） |
| 3 | `@arguments` の必須チェック | `@argumentDefinitions` があるフラグメントへのスプレッドには `@arguments` が必須 |
| 4 | `@arguments` の禁止チェック | `@argumentDefinitions` がないフラグメントへのスプレッドに `@arguments` は不要 |
| 5 | 引数名の一致 | 渡した引数名が宣言と完全に一致しているか（過不足なし） |
| 6 | 型の互換性 | 渡す変数の型が宣言された型と互換があるか |
| 7 | 宣言と使用の一致 | `@argumentDefinitions` で宣言した変数がフラグメント本体で実際に使われているか |

---

## 使い方

### インストール

```bash
npm install --save-dev graphql-codegen-fragment-argument-linter
# or
pnpm add -D graphql-codegen-fragment-argument-linter
```

### codegen.ts に追加

既存のプラグインと一緒に並べるだけです。

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
        'graphql-codegen-fragment-argument-linter',  // 追加するだけ
      ],
    },
  },
};

export default config;
```

### 動作確認

問題がなければ何も出力されずcodegenが完了します。問題がある場合はエラーを投げてcodegenを失敗させます。

```
$ pnpm codegen

Error: Fragment Argument Linter failed with 2 error(s):

# GraphQL Fragment Argument Linter Report

## Summary
- Fragments with issues: 1
- Total issues: 2

## Issues Found

### Fragment: UserCard

❌ **ERROR**: @arguments is required but missing (line 3, column 5)
❌ **ERROR**: Type mismatch for argument "userId": expected ID!, got ID (line 5, column 5)
```

### ルール詳細と例

#### Rule 3 — `@arguments` の必須チェック

```graphql
fragment UserCard on User @argumentDefinitions(userId: { type: "ID!" }) {
  friend(id: $userId) { id name }
}

# ✅ OK
...UserCard @arguments(userId: $userId)

# ❌ ERROR: @argumentDefinitions があるのに @arguments がない
...UserCard
```

#### Rule 5 — 引数名の一致

```graphql
fragment F on User @argumentDefinitions(userId: { type: "ID!" }, role: { type: "String!" }) { ... }

# ✅ OK
...F @arguments(userId: $userId, role: $role)

# ❌ ERROR: "unknown" は宣言されていない
...F @arguments(userId: $userId, unknown: $x)

# ❌ ERROR: "role" が不足している
...F @arguments(userId: $userId)
```

#### Rule 6 — 型の互換性

| 渡す型 | 宣言された型 | 結果 |
|--------|-------------|------|
| `T!` | `T!` | ✅ 完全一致 |
| `T!` | `T` | ✅ non-nullableはnullableに代入可能 |
| `T` | `T!` | ❌ nullableはnon-nullableに代入不可 |
| `T` | `T` | ✅ 完全一致 |

```graphql
fragment F on User @argumentDefinitions(userId: { type: "ID!" }) { ... }

# ✅ OK: ID! → ID!
query Q($userId: ID!) { ...F @arguments(userId: $userId) }

# ❌ ERROR: ID → ID!
query Q($userId: ID) { ...F @arguments(userId: $userId) }
```

#### Rule 7 — 宣言と使用の一致

```graphql
# ✅ OK: 宣言した $userId をフラグメント本体で使っている
fragment F on User @argumentDefinitions(userId: { type: "ID!" }) {
  friend(id: $userId) { id }
}

# ❌ ERROR: "role" を宣言しているが、フラグメント本体で使っていない
fragment F on User @argumentDefinitions(userId: { type: "ID!" }, role: { type: "String!" }) {
  friend(id: $userId) { id }
}
```

---

## まとめ

`graphql-codegen-fragment-argument-linter` を導入することで、`@argumentDefinitions` / `@arguments` パターンの正しい使用をcodegen実行時に自動検証できます。型安全なフラグメント管理をCIで保証できるようになります。

- npm: https://www.npmjs.com/package/graphql-codegen-fragment-argument-linter
