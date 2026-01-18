# テスト仕様書

## テスト概要

GraphQL Fragment Argument Linter のテストスイート。

- **総テスト数**: 35 tests
- **テストファイル**: 2 files
  - `tests/plugin.test.ts` (19 tests)
  - `tests/visitor.test.ts` (16 tests)

## テストカテゴリ

### 1. plugin.test.ts - 統合テスト

#### 基本動作
- ✅ フラグメントがない場合は成功する
- ✅ フラグメントが1つある場合、統計情報が正しい

#### requireArgumentDefinitions オプション
- ✅ false の場合、@argumentDefinitions がなくてもエラーにならない
- ✅ true（デフォルト）の場合、@argumentDefinitions がないとエラーになる
- ✅ @argumentDefinitions がある場合は成功する

#### フラグメントスプレッドの検証
- ✅ @argumentDefinitions がある場合、スプレッド時に @arguments が必須
- ✅ @argumentDefinitions と @arguments が両方ある場合は成功
- ✅ @argumentDefinitions がない場合、@arguments なしでもOK
- ✅ **@arguments があるのに @argumentDefinitions がない場合はエラー** ⭐ NEW
- ✅ ネストしたフラグメントスプレッドも検証される

#### 複数フラグメントの処理
- ✅ 複数のフラグメントをそれぞれ検証する
- ✅ 複数のエラーをすべて報告する

#### エラーレポート
- ✅ エラーメッセージに位置情報が含まれる
- ✅ エラーレポートにフラグメント名が含まれる
- ✅ フラグメント名でグルーピングされる

#### 複数ファイルの処理
- ✅ 複数のドキュメントファイルを処理できる

#### エッジケース
- ✅ 空のドキュメント
- ✅ フラグメント定義のみでスプレッドがない
- ✅ フラグメント内でフラグメントを使用

---

### 2. visitor.test.ts - ユニットテスト

#### validateFragment
- ✅ requireArgumentDefinitions が false の場合、エラーにならない
- ✅ requireArgumentDefinitions が true の場合、エラーになる
- ✅ @argumentDefinitions がある場合、エラーにならない
- ✅ 位置情報が正しく記録される

#### collectFragmentSpread
- ✅ フラグメントスプレッドを記録する
- ✅ @arguments の有無を正しく記録する

#### validateFragmentSpreads
- ✅ @argumentDefinitions があるのに @arguments がない場合、エラーになる
- ✅ @argumentDefinitions と @arguments が両方ある場合、エラーにならない
- ✅ @argumentDefinitions がない場合、@arguments がなくてもエラーにならない
- ✅ **@argumentDefinitions がないのに @arguments がある場合、エラーになる** ⭐ NEW
- ✅ 複数のスプレッドをすべて検証する

#### getIssues / getStats
- ✅ Issue がない場合、空配列が返る
- ✅ 統計情報が正しく集計される
- ✅ 同じフラグメントに複数の Issue がある場合、fragmentsWithIssues は1

#### addIssue の副作用
- ✅ Issue を追加すると fragmentsWithIssues にフラグメント名が追加される
- ✅ Issue のレベルが正しく設定される

---

## テスト実行

```bash
# すべてのテストを実行
pnpm test

# watch モードで実行
pnpm test -- --watch

# カバレッジ付きで実行
pnpm test -- --coverage
```

## テストデータ

### スキーマ

```graphql
type Query {
  user(id: ID!): User
  post(id: ID!): Post
}

type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
}
```

### テストケースの例

#### 成功ケース

```graphql
fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
  id
  name
}

query GetUser($userId: ID!) {
  user(id: $userId) {
    ...UserFields @arguments(userId: $userId)
  }
}
```

#### 失敗ケース

```graphql
fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
  id
  name
}

query GetUser {
  user(id: "1") {
    ...UserFields  # ❌ @arguments がない
  }
}
```

---

## カバレッジ目標

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

---

## 今後のテスト追加予定

- [ ] パフォーマンステスト（大量のフラグメント）
- [ ] エラーハンドリングテスト（不正な AST）
- [ ] 位置情報の精度テスト
- [ ] 複雑なネスト構造のテスト
- [ ] 循環参照のテスト

