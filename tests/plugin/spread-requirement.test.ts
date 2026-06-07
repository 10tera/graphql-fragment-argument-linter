import { parse } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
import { describe, test, expect } from 'vitest';
import { plugin } from '../../src/plugin';
import { schema, config } from './helpers';

describe('@arguments の要否チェック', () => {
  describe('@argumentDefinitions があれば @arguments が必須', () => {
    test('@arguments なしでスプレッドするとエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
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
            friend(id: $userId) { id }
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('ネストした選択の中でも検証される', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
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

    test('@argumentDefinitions が空でも @arguments が必要', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions { id }

          query GetUser {
            user(id: "1") { ...UserFields }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('must have @arguments directive');
    });

    test('@argumentDefinitions が空で @arguments も空の場合はエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions { id }

          query GetUser {
            user(id: "1") { ...UserFields @arguments }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });
  });

  describe('@argumentDefinitions がなければ @arguments は禁止', () => {
    test('@argumentDefinitions がないのに @arguments をつけるとエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User { id name }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
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

  describe('フラグメント内フラグメントのスプレッド', () => {
    test('フラグメントスコープで @arguments なしでスプレッドするとエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment Inner on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          fragment Outer on User {
            ...Inner
          }

          query GetUser {
            user(id: "1") { ...Outer }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('must have @arguments directive');
    });

    test('フラグメントスコープで @arguments ありでスプレッドするとエラーなし', () => {
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

    test('フラグメントスコープで @argumentDefinitions なしのフラグメントに @arguments をつけるとエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment Inner on User { id name }

          fragment Outer on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
            ...Inner @arguments(userId: $userId)
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...Outer @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('does not define @argumentDefinitions');
    });
  });

  describe('匿名オペレーション', () => {
    test('匿名 query で @arguments なしでスプレッドするとエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          query {
            user(id: "1") { ...UserFields }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('must have @arguments directive');
    });

    test('匿名 query で @arguments ありでスプレッドするとエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          query($userId: ID!) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('匿名 query で @argumentDefinitions なしのフラグメントに @arguments をつけるとエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User { id name }

          query($userId: ID!) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('does not define @argumentDefinitions');
    });
  });

  describe('@skip / @include との併用', () => {
    test('@arguments と @skip を同時につけてもエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          query GetUser($userId: ID!, $skip: Boolean!) {
            user(id: $userId) { ...UserFields @skip(if: $skip) @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('@arguments と @include を同時につけてもエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          query GetUser($userId: ID!, $include: Boolean!) {
            user(id: $userId) { ...UserFields @include(if: $include) @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('@skip だけで @arguments がない場合はエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          query GetUser($skip: Boolean!) {
            user(id: "1") { ...UserFields @skip(if: $skip) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('must have @arguments directive');
    });
  });

  describe('複数ファイル構成', () => {
    test('フラグメントと query が別ファイルで @arguments なしの場合はエラー', () => {
      const documents = [
        {
          location: 'fragment.graphql',
          document: parse(`
            fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
              friend(id: $userId) { id }
            }
          `)
        },
        {
          location: 'query.graphql',
          document: parse(`
            query GetUser {
              user(id: "1") { ...UserFields }
            }
          `)
        },
      ] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('must have @arguments directive');
    });

    test('フラグメントと query が別ファイルで @argumentDefinitions なしのフラグメントに @arguments をつけるとエラー', () => {
      const documents = [
        {
          location: 'fragment.graphql',
          document: parse(`
            fragment UserFields on User { id name }
          `)
        },
        {
          location: 'query.graphql',
          document: parse(`
            query GetUser($userId: ID!) {
              user(id: $userId) { ...UserFields @arguments(userId: $userId) }
            }
          `)
        },
      ] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('does not define @argumentDefinitions');
    });
  });
});
