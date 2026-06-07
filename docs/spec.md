# GraphQL Fragment Argument Linter - 仕様書

## 概要

GraphQL Code Generator のプラグインとして動作し、Fragment の引数定義（`@argumentDefinitions`）と引数渡し（`@arguments`）の整合性を静的に検証する。

検証に使用するディレクティブはビルド専用であり、実行時 GraphQL には含まれない。

---

## Lint ディレクティブ

| ディレクティブ | 付与対象 | 役割 |
|---|---|---|
| `@argumentDefinitions` | Fragment 定義 | Fragment が受け取る引数を宣言する |
| `@arguments` | Fragment スプレッド | Fragment に引数を渡す |

---

## バリデーションルール

### Rule 1: `@argumentDefinitions` の構文チェック

`@argumentDefinitions` の各引数は、以下の形式でなければならない。

```graphql
@argumentDefinitions(
  argName: { type: "GraphQL型文字列" }
)
```

**検証内容:**
- 各引数の値がオブジェクト形式 `{ type: "..." }` であること
- `type` フィールドが存在し、文字列値であること
- `type` の値が有効な GraphQL 型文字列であること（例: `ID!`, `String`, `[Int!]!`）

```graphql
# ✅ OK
fragment UserFields on User
  @argumentDefinitions(
    userId: { type: "ID!" }
    name: { type: "String" }
  ) { ... }

# ❌ ERROR: type フィールドなし
fragment UserFields on User
  @argumentDefinitions(
    userId: { foo: "bar" }
  ) { ... }

# ❌ ERROR: 不正な GraphQL 型
fragment UserFields on User
  @argumentDefinitions(
    userId: { type: "!!!" }
  ) { ... }
```

---

### Rule 2: `@arguments` の構文チェック

`@arguments` の各引数値は変数参照でなければならない。

```graphql
# ✅ OK
...UserFields @arguments(userId: $userId)

# ❌ ERROR: リテラル値は不可
...UserFields @arguments(userId: "123")

# ❌ ERROR: null は不可
...UserFields @arguments(userId: null)
```

---

### Rule 3: `@arguments` の要否チェック

`@argumentDefinitions` が付いている Fragment をスプレッドする際は、`@arguments` が必須。

```graphql
fragment UserFields on User
  @argumentDefinitions(userId: { type: "ID!" }) { ... }

# ✅ OK
query GetUser($userId: ID!) {
  user(id: $userId) {
    ...UserFields @arguments(userId: $userId)
  }
}

# ❌ ERROR: @arguments が必要
query GetUser {
  user(id: "1") {
    ...UserFields
  }
}
```

> **備考**: 将来的に全引数が `defaultValue` を持つ場合は `@arguments` 省略を許容する予定。

### Rule 4: `@arguments` の禁止チェック

`@argumentDefinitions` がない Fragment のスプレッドに `@arguments` を付けることは禁止。

```graphql
fragment UserFields on User { ... }

# ✅ OK
query GetUser {
  user(id: "1") {
    ...UserFields
  }
}

# ❌ ERROR: @argumentDefinitions がないのに @arguments を付けている
query GetUser {
  user(id: "1") {
    ...UserFields @arguments(userId: $userId)
  }
}
```

---

### Rule 5: 引数名の一致チェック

`@arguments` で渡す引数名は、対応する Fragment の `@argumentDefinitions` で定義された引数名と一致しなければならない。

**検証内容:**
- `@arguments` に含まれる各引数名が `@argumentDefinitions` に存在すること（未定義の引数を渡したらエラー）
- `@argumentDefinitions` で定義された各引数が `@arguments` に含まれていること（省略禁止）

```graphql
fragment UserFields on User
  @argumentDefinitions(
    userId: { type: "ID!" }
    role: { type: "String!" }
  ) { ... }

# ✅ OK
...UserFields @arguments(userId: $userId, role: $role)

# ❌ ERROR: "unknown" は定義されていない引数
...UserFields @arguments(userId: $userId, unknown: $x)

# ❌ ERROR: "role" が不足している
...UserFields @arguments(userId: $userId)
```

> **備考**: `defaultValue` の導入後は、defaultValue を持つ引数は省略可能とする予定。

---

### Rule 6: 引数の型互換性チェック

`@arguments` で渡す変数の型は、`@argumentDefinitions` で宣言された型と互換性がなければならない。

**型の互換性ルール:**

| 変数の型 | 引数の定義型 | 結果 |
|---------|------------|------|
| `T!` | `T!` | ✅ OK（完全一致） |
| `T!` | `T` | ✅ OK（non-nullable を nullable に渡せる） |
| `T` | `T!` | ❌ ERROR（nullable を non-nullable に渡せない） |
| `T` | `T` | ✅ OK（完全一致） |

```graphql
fragment UserFields on User
  @argumentDefinitions(
    userId: { type: "ID!" }
    label: { type: "String" }
  ) { ... }

# ✅ OK: ID! → ID!（完全一致）
query Q($userId: ID!, $label: String!) {
  user(id: $userId) { ...UserFields @arguments(userId: $userId, label: $label) }
}

# ✅ OK: String! → String（non-nullable を nullable に渡せる）
query Q($userId: ID!, $label: String!) {
  user(id: $userId) { ...UserFields @arguments(userId: $userId, label: $label) }
}

# ❌ ERROR: ID → ID!（nullable を non-nullable に渡せない）
query Q($userId: ID, $label: String) {
  user(id: $userId) { ...UserFields @arguments(userId: $userId, label: $label) }
}
```

**対象となる型:**

標準 GraphQL スカラー型および任意の named type を使用できる。nullability（`!`）とリスト（`[T]`）の組み合わせも対象。

```graphql
# 有効な型の例
{ type: "ID!" }
{ type: "String" }
{ type: "Int!" }
{ type: "Boolean" }
{ type: "[String!]!" }
{ type: "[ID]" }
```

変数の型は、スプレッドが書かれているスコープから解決する。

- **operation スコープ**: Query / Mutation / Subscription の `variableDefinitions`
- **fragment スコープ**: 親 Fragment の `@argumentDefinitions`

---

### Rule 7: 変数宣言と使用の完全一致チェック

`@argumentDefinitions` を持つ Fragment では、selectionSet 内で使われている変数の集合と `@argumentDefinitions` で宣言されている引数の集合が完全に一致しなければならない。

`@argumentDefinitions` を持たない Fragment は変数を自由に使用できる（呼び出し元の operation から変数が流れる標準 GraphQL の挙動）。

**「変数の使用」に該当するもの:**
- フィールド引数: `field(id: $userId)`
- ディレクティブ引数: `field @skip(if: $flag)`
- 子フラグメントへの引数渡し: `...Child @arguments(userId: $userId)`

```graphql
# ✅ OK: 宣言と使用が一致
fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
  friend(id: $userId) { id }
}

# ✅ OK: @argumentDefinitions がない Fragment は変数を自由に使える
fragment UserFields on User {
  friend(id: $userId) { id }
}

# ❌ ERROR: $undeclared は @argumentDefinitions に存在しない
fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
  friend(id: $undeclared) { id }
}

# ❌ ERROR: userId は宣言されているが fragment 内で使われていない
fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
  id
  name
}
```

---

## 未実装・検討事項

| 項目 | 状態 | 備考 |
|---|---|---|
| `defaultValue` のサポート | 未実装 | 導入後は Rule 3・Rule 5 で省略許容の条件が変わる |
| `@arguments` へのリテラル値渡し | 未実装 | 現状は変数参照 `$var` のみ許可 |
| オーファンフラグメント検出 | 未実装 | どこにも spread されていない Fragment を警告する |
| Transform（ディレクティブ除去・Fragment Inlining） | 未実装 | 出力 GraphQL からカスタムディレクティブを除去する |
