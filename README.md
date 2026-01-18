# graphql-fragment-argument-linter

GraphQL Code Generatorのプラグインで、GraphQLフラグメントの引数を検証・リントします。

## 特徴

- 🔍 フラグメント引数の検証
- 📝 型の明示的な宣言をチェック
- 📚 ドキュメントの存在確認
- 🎯 命名規則の強制（strictモード）
- 🔧 カスタム検証ルールのサポート
- 📊 詳細な検証レポート生成

## インストール

```bash
pnpm add -D graphql-fragment-argument-linter
```

または

```bash
npm install --save-dev graphql-fragment-argument-linter
```

## 使い方

### 基本的な設定

`codegen.ts`ファイルを作成：

```typescript
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './schema.graphql',
  documents: ['./src/**/*.graphql'],
  generates: {
    './generated/lint-report.md': {
      plugins: ['graphql-fragment-argument-linter']
    }
  }
};

export default config;
```

または`codegen.yml`を使用：

```yaml
schema: ./schema.graphql
documents: './src/**/*.graphql'
generates:
  ./generated/lint-report.md:
    plugins:
      - graphql-fragment-argument-linter
```

### 設定オプション

```typescript
const config: CodegenConfig = {
  schema: './schema.graphql',
  documents: ['./src/**/*.graphql'],
  generates: {
    './generated/lint-report.md': {
      plugins: [
        {
          'graphql-fragment-argument-linter': {
            // 厳密モードを有効化（命名規則を強制）
            strictMode: true,
            
            // 検証から除外するフラグメント名のリスト
            ignoreFragments: ['LegacyFragment', 'DeprecatedFragment'],
            
            // すべての引数に明示的な型を要求（デフォルト: true）
            requireExplicitTypes: true,
            
            // すべての引数にドキュメントを要求（デフォルト: false）
            requireDocumentation: true,
            
            // カスタム検証ルール
            customRules: [
              {
                name: 'custom-rule-example',
                validate: (fragmentName, args) => {
                  // カスタム検証ロジック
                  return [];
                }
              }
            ]
          }
        }
      ]
    }
  }
};
```

## 設定オプション詳細

| オプション | 型 | デフォルト | 説明 |
|----------|------|-----------|------|
| `strictMode` | `boolean` | `false` | 厳密モードを有効化。フラグメント名と引数名の命名規則をチェック |
| `ignoreFragments` | `string[]` | `[]` | 検証から除外するフラグメント名のリスト |
| `requireExplicitTypes` | `boolean` | `true` | すべてのフラグメント引数に明示的な型を要求 |
| `requireDocumentation` | `boolean` | `false` | すべてのフラグメント引数にドキュメントを要求 |
| `customRules` | `CustomRule[]` | `[]` | カスタム検証ルールの配列 |

## 出力例

プラグインは以下のような形式のレポートを生成します：

```markdown
# GraphQL Fragment Argument Linter Report

## Summary
- Fragments checked: 5
- Fragments with issues: 2
- Total issues: 3

## Issues Found

### Fragment: userFields
❌ **ERROR**: Fragment "userFields" with arguments must use PascalCase naming
⚠️ **WARNING**: Fragment argument "userId" should have documentation

### Fragment: PostDetails
❌ **ERROR**: Fragment argument "PostId" must use camelCase naming
```

## 開発

### セットアップ

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm run build

# テスト実行
pnpm run test

# 開発モード（ウォッチモード）
pnpm run dev
```

### ディレクトリ構造

```
graphql-fragment-argument-linter/
├── src/
│   ├── index.ts      # エントリーポイント
│   ├── plugin.ts     # プラグイン本体
│   ├── visitor.ts    # GraphQL AST Visitor
│   └── types.ts      # 型定義
├── tests/
│   └── plugin.test.ts # ユニットテスト
└── dist/             # ビルド出力（生成される）
```

## 技術スタック

- **TypeScript** - 型安全な開発
- **GraphQL** - GraphQLスキーマとドキュメントの解析
- **Vitest** - 高速なテストランナー
- **GraphQL Code Generator** - プラグインフレームワーク

## ライセンス

MIT

## コントリビューション

Issue や Pull Request は歓迎します！

## サポート

問題が発生した場合は、[GitHub Issues](https://github.com/yourusername/graphql-fragment-argument-linter/issues)で報告してください。
