import { parse } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
import { describe, test, expect } from 'vitest';
import { plugin } from '../../src/plugin';
import { schema, config } from './helpers';

describe('引数名の一致チェック', () => {
  test('引数名が完全一致する場合はエラーなし', () => {
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

  test('複数引数がすべて一致する場合はエラーなし', () => {
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

        query GetUser($userId: ID!, $showFriend: Boolean!) {
          user(id: $userId) {
            ...UserFields @arguments(userId: $userId, showFriend: $showFriend)
          }
        }
      `)
    }] satisfies Types.DocumentFile[];

    expect(() => plugin(schema, documents, config)).not.toThrow();
  });

  test('@arguments に未定義の引数名を渡すとエラー', () => {
    const documents = [{
      location: 'test.graphql',
      document: parse(`
        fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
          friend(id: $userId) { id }
        }

        query GetUser($userId: ID!, $extra: ID!) {
          user(id: $userId) {
            ...UserFields @arguments(userId: $userId, extra: $extra)
          }
        }
      `)
    }] satisfies Types.DocumentFile[];

    expect(() => plugin(schema, documents, config)).toThrow();
  });

  test('@argumentDefinitions で定義した引数が @arguments で省略されているとエラー', () => {
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

        query GetUser($userId: ID!) {
          user(id: $userId) {
            ...UserFields @arguments(userId: $userId)
          }
        }
      `)
    }] satisfies Types.DocumentFile[];

    expect(() => plugin(schema, documents, config)).toThrow();
  });

  test('複数引数の一部が不一致の場合はエラー', () => {
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

        query GetUser($userId: ID!, $flag: Boolean!) {
          user(id: $userId) {
            ...UserFields @arguments(userId: $userId, unknown: $flag)
          }
        }
      `)
    }] satisfies Types.DocumentFile[];

    expect(() => plugin(schema, documents, config)).toThrow();
  });
});
