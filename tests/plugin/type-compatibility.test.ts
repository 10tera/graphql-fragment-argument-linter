import { parse } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
import { describe, test, expect } from 'vitest';
import { plugin } from '../../src/plugin';
import { schema, config } from './helpers';

describe('引数の型互換性チェック', () => {
  describe('operation スコープ', () => {
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
            friend(id: $userId) { id }
          }

          query GetUser($userId: ID) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('is not compatible with');
    });

    test('複数引数で一部の型が不正な場合はエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User
            @argumentDefinitions(
              userId: { type: "ID!" }
              showFriend: { type: "Boolean!" }
            ) {
            friend(id: $userId) @skip(if: $showFriend) { id }
          }

          query GetUser($userId: ID!, $showFriend: Boolean) {
            user(id: $userId) {
              ...UserFields @arguments(userId: $userId, showFriend: $showFriend)
            }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('is not compatible with');
    });

    test('同じフラグメントを複数箇所でスプレッドし一方の型が不正な場合はエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          query GetUsers($userId1: ID!, $userId2: ID) {
            user1: user(id: $userId1) { ...UserFields @arguments(userId: $userId1) }
            user2: user(id: $userId2) { ...UserFields @arguments(userId: $userId2) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('is not compatible with');
    });

    test('Mutation スコープでも型チェックが効く', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          mutation UpdateUser($userId: ID) {
            updateUser(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('is not compatible with');
    });
  });

  describe('fragment スコープ（ネストしたフラグメント）', () => {
    test('型が完全一致する場合はエラーなし', () => {
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

    test('nullable 変数を non-nullable 引数に渡せない', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment Inner on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

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

    test('3段階ネストで型が一致する場合はエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment FragC on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          fragment FragB on User @argumentDefinitions(userId: { type: "ID!" }) {
            ...FragC @arguments(userId: $userId)
          }

          fragment FragA on User @argumentDefinitions(userId: { type: "ID!" }) {
            ...FragB @arguments(userId: $userId)
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...FragA @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('3段階ネストで中間フラグメントの型が不正な場合はエラー', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment FragC on User @argumentDefinitions(userId: { type: "ID!" }) {
            friend(id: $userId) { id }
          }

          fragment FragB on User @argumentDefinitions(userId: { type: "ID" }) {
            ...FragC @arguments(userId: $userId)
          }

          fragment FragA on User @argumentDefinitions(userId: { type: "ID!" }) {
            ...FragB @arguments(userId: $userId)
          }

          query GetUser($userId: ID!) {
            user(id: $userId) { ...FragA @arguments(userId: $userId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('is not compatible with');
    });
  });
});
