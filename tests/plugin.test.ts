import { buildSchema, parse } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
import { plugin } from '../src/plugin';
import { FragmentArgumentLinterConfig } from '../src/types';
import { describe, test, expect } from 'vitest';

describe('Fragment Argument Linter Plugin', () => {
  const schema = buildSchema(`
    type Query {
      user(id: ID!): User
      post(id: ID!): Post
    }

    type User {
      id: ID!
      name: String!
      email: String!
      posts: [Post!]!
      friend(id: ID): User
    }

    type Post {
      id: ID!
      title: String!
      content: String!
      author: User!
    }
  `);

  const config: FragmentArgumentLinterConfig = {};

  describe('基本動作', () => {
    test('フラグメントがない場合はエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          query GetUser {
            user(id: "1") { id name }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('フラグメントが1つある場合、エラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User { id name }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });
  });

  describe('@argumentDefinitions があれば @arguments が必須', () => {
    test('@arguments なしでスプレッドするとエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            id name
          }

          query GetUser {
            user(id: "1") { ...UserFields }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('must have @arguments directive');
    });

    test('@arguments ありでスプレッドするとエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            id
            friend(id: $userId) { id }
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('ネストした選択でも検証される', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(showEmail: { type: "Boolean!" }) {
            id name
          }

          query GetUser {
            user(id: "1") {
              posts { author { ...UserFields } }
            }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('must have @arguments directive');
    });
  });

  describe('@argumentDefinitions がなければ @arguments は禁止', () => {
    test('@argumentDefinitions がないのに @arguments をつけるとエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User { id name }

          query GetUser {
            user(id: "1") { ...UserFields @arguments(userId: "1") }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('does not define @argumentDefinitions');
    });

    test('@argumentDefinitions も @arguments もない場合はエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User { id name }

          query GetUser {
            user(id: "1") { ...UserFields }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });
  });

  describe('複数フラグメントの処理', () => {
    test('複数フラグメントを @argumentDefinitions(空) + @arguments(空) でスプレッドするとエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserBasic on User @argumentDefinitions { id }
          fragment PostBasic on Post @argumentDefinitions { id }

          query GetData {
            user(id: "1") { ...UserBasic @arguments }
            post(id: "1") { ...PostBasic @arguments }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('複数フラグメントでエラーがある場合、すべて報告される', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserBasic on User @argumentDefinitions { id }
          fragment PostBasic on Post { id }

          query GetData {
            user(id: "1") { ...UserBasic }
            post(id: "1") { ...PostBasic @arguments }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('2 error(s)');
    });
  });

  describe('変数宣言と使用の整合性チェック', () => {
    test('@argumentDefinitions で宣言した変数が fragment 内で未使用の場合エラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            id name
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('never used in the fragment body');
    });

    test('fragment 内で使っている変数が @argumentDefinitions に未宣言の場合エラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
            friend(id: $undeclared) { id }
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('not declared in @argumentDefinitions');
    });

    test('変数をフィールドにも使いつつ子フラグメントにも渡す場合はエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment Inner on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          fragment Outer on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
            ...Inner @arguments(userId: $userId)
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...Outer @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('変数をフィールドにも使いつつ子フラグメントにも渡すが宣言されていない場合はエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment Inner on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          fragment Outer on User @argumentDefinitions(otherId: { type: "ID!" }) {
            friend(id: $userId) { id }
            ...Inner @arguments(userId: $userId)
          }

          query GetUser($userId: ID!, $otherId: ID!) {
            user(id: $userId) { ...Outer @arguments(otherId: $otherId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('not declared in @argumentDefinitions');
    });

    test('宣言した変数を子フラグメントへの @arguments で使う場合は使用とみなす', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment Inner on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          fragment Outer on User @argumentDefinitions(userId: { type: "ID!" }) {
            ...Inner @arguments(userId: $userId)
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...Outer @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });
  });

  describe('引数の型互換性チェック', () => {
    test('型が完全一致する場合はエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('non-nullable 変数を nullable 引数に渡せる（ID! → ID）', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID" }) {
            friend(id: $userId) { id }
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('nullable 変数を non-nullable 引数に渡せない（ID → ID!）', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            id
          }

          query GetUser($userId: ID) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('is not compatible with');
    });

    test('フラグメントスコープ内でも型チェックが効く', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment Inner on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          fragment Outer on User @argumentDefinitions(userId: { type: "ID!" }) {
            ...Inner @arguments(userId: $userId)
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...Outer @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('フラグメントスコープ内で nullable 変数を non-nullable 引数に渡せない', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment Inner on User @argumentDefinitions(userId: { type: "ID!" }) { id }

          fragment Outer on User @argumentDefinitions(userId: { type: "ID" }) {
            ...Inner @arguments(userId: $userId)
          }

          query GetUser($userId: ID) {
            user(id: $userId) { ...Outer @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('is not compatible with');
    });
  });
});
