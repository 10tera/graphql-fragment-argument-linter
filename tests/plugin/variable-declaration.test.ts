import { parse } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
import { describe, test, expect } from 'vitest';
import { plugin } from '../../src/plugin';
import { schema, config } from './helpers';

describe('変数宣言と使用の整合性チェック', () => {
  describe('宣言と使用が一致する場合', () => {
    test('フィールド引数で変数を使う場合はエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserWithFriend on User @argumentDefinitions(friendId: { type: "ID!" }) {
            friend(id: $friendId) { id name }
          }

          query GetUserWithFriend($userId: ID!, $friendId: ID!) {
            user(id: $userId) { ...UserWithFriend @arguments(friendId: $friendId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('ディレクティブ引数で変数を使う場合はエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserProfile on User @argumentDefinitions(showEmail: { type: "Boolean!" }) {
            name
            email @include(if: $showEmail)
          }

          query GetUserProfile($userId: ID!, $showEmail: Boolean!) {
            user(id: $userId) { ...UserProfile @arguments(showEmail: $showEmail) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('子フラグメントへの @arguments で変数を渡す場合は使用とみなす', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment FriendDetails on User @argumentDefinitions(friendId: { type: "ID!" }) {
            friend(id: $friendId) { id name }
          }

          fragment UserCard on User @argumentDefinitions(friendId: { type: "ID!" }) {
            name
            ...FriendDetails @arguments(friendId: $friendId)
          }

          query GetUserCard($userId: ID!, $friendId: ID!) {
            user(id: $userId) { ...UserCard @arguments(friendId: $friendId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('変数をフィールドにも使いつつ子フラグメントにも渡す場合はエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment FriendPosts on User @argumentDefinitions(friendId: { type: "ID!" }) {
            friend(id: $friendId) { posts { title } }
          }

          fragment UserWithFriend on User @argumentDefinitions(friendId: { type: "ID!" }) {
            friend(id: $friendId) { id name }
            ...FriendPosts @arguments(friendId: $friendId)
          }

          query GetUserWithFriend($userId: ID!, $friendId: ID!) {
            user(id: $userId) { ...UserWithFriend @arguments(friendId: $friendId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });

    test('@argumentDefinitions がない fragment は変数を自由に使えてエラーなし', () => {
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserWithFriend on User {
            friend(id: $friendId) { id name }
          }

          query GetUser($userId: ID!, $friendId: ID!) {
            user(id: $userId) { ...UserWithFriend }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).not.toThrow();
    });
  });

  describe('宣言と使用が一致しない場合', () => {
    test('@argumentDefinitions で宣言した変数が fragment 内で未使用の場合エラー', () => {
      // showEmail を宣言したが fragment body でどこにも使っていない
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserBasic on User @argumentDefinitions(showEmail: { type: "Boolean!" }) {
            id name
          }

          query GetUser($userId: ID!, $showEmail: Boolean!) {
            user(id: $userId) { ...UserBasic @arguments(showEmail: $showEmail) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('never used in the fragment body');
    });

    test('fragment 内で使っている変数が @argumentDefinitions に未宣言の場合エラー', () => {
      // friendId は宣言済みだが、showEmail は宣言なしで @include に使っている
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment UserProfile on User @argumentDefinitions(friendId: { type: "ID!" }) {
            friend(id: $friendId) { id }
            email @include(if: $showEmail)
          }

          query GetUser($userId: ID!, $friendId: ID!) {
            user(id: $userId) { ...UserProfile @arguments(friendId: $friendId) }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('not declared in @argumentDefinitions');
    });

    test('変数をフィールドにも使いつつ子フラグメントにも渡すが宣言されていない場合はエラー', () => {
      // AuthorCard は authorId を宣言しているが、friendId（未宣言）をフィールドと子フラグメント両方に使っている
      const documents = [{
        location: 'test.graphql',
        document: parse(`
          fragment FriendDetails on User @argumentDefinitions(friendId: { type: "ID!" }) {
            friend(id: $friendId) { id name }
          }

          fragment AuthorCard on User @argumentDefinitions(authorId: { type: "ID!" }) {
            friend(id: $friendId) { id }
            ...FriendDetails @arguments(friendId: $friendId)
          }

          query GetPost($postId: ID!, $authorId: ID!) {
            post(id: $postId) { author { ...AuthorCard @arguments(authorId: $authorId) } }
          }
        `)
      }] satisfies Types.DocumentFile[];

      expect(() => plugin(schema, documents, config)).toThrow('not declared in @argumentDefinitions');
    });
  });
});
