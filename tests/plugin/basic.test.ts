import { parse } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
import { describe, test, expect } from 'vitest';
import { plugin } from '../../src/plugin';
import { schema, config } from './helpers';

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

  test('フラグメントが1つある場合はエラーなし', () => {
    const documents = [{
      location: 'test.graphql',
      document: parse(`
        fragment UserFields on User { id name }
      `)
    }] satisfies Types.DocumentFile[];

    expect(() => plugin(schema, documents, config)).not.toThrow();
  });

  test('複数フラグメントがすべて正常な場合はエラーなし', () => {
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

  test('フラグメントと query を別ファイルに分けても検証できる', () => {
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
          query GetUser($userId: ID!) {
            user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          }
        `)
      },
    ] satisfies Types.DocumentFile[];

    expect(() => plugin(schema, documents, config)).not.toThrow();
  });

  test('同じフラグメントを複数箇所でスプレッドしてもそれぞれ検証される', () => {
    const documents = [{
      location: 'test.graphql',
      document: parse(`
        fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
          friend(id: $userId) { id }
        }

        query GetUsers($userId1: ID!, $userId2: ID!) {
          user1: user(id: $userId1) { ...UserFields @arguments(userId: $userId1) }
          user2: user(id: $userId2) { ...UserFields @arguments(userId: $userId2) }
        }
      `)
    }] satisfies Types.DocumentFile[];

    expect(() => plugin(schema, documents, config)).not.toThrow();
  });

  test('同じフラグメントを複数箇所でスプレッドしたとき一方に問題があればエラー', () => {
    const documents = [{
      location: 'test.graphql',
      document: parse(`
        fragment UserFields on User @argumentDefinitions(userId: { type: "ID!" }) {
          friend(id: $userId) { id }
        }

        query GetUsers($userId: ID!) {
          user1: user(id: $userId) { ...UserFields @arguments(userId: $userId) }
          user2: user(id: $userId) { ...UserFields }
        }
      `)
    }] satisfies Types.DocumentFile[];

    expect(() => plugin(schema, documents, config)).toThrow('must have @arguments directive');
  });
});
