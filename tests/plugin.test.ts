import { buildSchema, parse } from 'graphql';
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
    }

    type Post {
      id: ID!
      title: String!
      content: String!
      author: User!
    }
  `);

  describe('基本動作', () => {
    test('フラグメントがない場合は成功する', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            query GetUser {
              user(id: "1") {
                id
                name
              }
            }
          `)
        }
      ];

      const config: FragmentArgumentLinterConfig = {};
      const result = plugin(schema, documents, config);

      expect(result).toContain('Fragment Argument Linter Report');
      expect(result).toContain('No issues found');
    });

    test('フラグメントが1つある場合、統計情報が正しい', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            fragment UserFields on User {
              id
              name
            }
          `)
        }
      ];

      const config: FragmentArgumentLinterConfig = {
        requireArgumentDefinitions: false
      };
      const result = plugin(schema, documents, config);

      expect(result).toContain('Fragments with issues: 0');
      expect(result).toContain('Total issues: 0');
    });
  });

  describe('requireArgumentDefinitions オプション', () => {
    test('requireArgumentDefinitions が false の場合、@argumentDefinitions がなくてもエラーにならない', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            fragment UserFields on User {
              id
              name
            }
          `)
        }
      ];

      const config: FragmentArgumentLinterConfig = {
        requireArgumentDefinitions: false
      };
      const result = plugin(schema, documents, config);

      expect(result).toContain('No issues found');
    });

    test('requireArgumentDefinitions が true（デフォルト）の場合、@argumentDefinitions がないとエラーになる', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            fragment UserFields on User {
              id
              name
            }
          `)
        }
      ];

      // デフォルト設定（requireArgumentDefinitions: true）
      const config: FragmentArgumentLinterConfig = {};
      
      expect(() => {
        plugin(schema, documents, config);
      }).toThrow('Fragment Argument Linter failed');
    });

    test('@argumentDefinitions がある場合は成功する', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
              id
              name
            }
          `)
        }
      ];

      const config: FragmentArgumentLinterConfig = {
        requireArgumentDefinitions: true
      };
      const result = plugin(schema, documents, config);

      expect(result).toContain('No issues found');
    });
  });

  describe('フラグメントスプレッドの検証', () => {
    test('@argumentDefinitions がある場合、スプレッド時に @arguments が必須', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
              id
              name
            }

            query GetUser {
              user(id: "1") {
                ...UserFields
              }
            }
          `)
        }
      ];

      const config: FragmentArgumentLinterConfig = {};
      
      expect(() => {
        plugin(schema, documents, config);
      }).toThrow('must have @arguments directive');
    });

    test('@argumentDefinitions と @arguments が両方ある場合は成功', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
              id
              name
            }

            query GetUser($userId: ID!) {
              user(id: $userId) {
                ...UserFields @arguments(userId: $userId)
              }
            }
          `)
        }
      ];

      const config: FragmentArgumentLinterConfig = {};
      const result = plugin(schema, documents, config);

      expect(result).toContain('No issues found');
    });

    test('@arguments があるのに @argumentDefinitions がない場合はエラー', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            fragment UserFields on User {
              id
              name
            }

            query GetUser {
              user(id: "1") {
                ...UserFields @arguments(userId: "1")
              }
            }
          `)
        }
      ];

      const config: FragmentArgumentLinterConfig = {
        requireArgumentDefinitions: false
      };
      
      expect(() => {
        plugin(schema, documents, config);
      }).toThrow('does not define @argumentDefinitions');
    });

    test('@argumentDefinitions がない場合、@arguments なしでもOK', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            fragment UserFields on User {
              id
              name
            }

            query GetUser {
              user(id: "1") {
                ...UserFields
              }
            }
          `)
        }
      ];

      const config: FragmentArgumentLinterConfig = {
        requireArgumentDefinitions: false
      };
      const result = plugin(schema, documents, config);

      expect(result).toContain('No issues found');
    });

    test('ネストしたフラグメントスプレッドも検証される', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            fragment UserFields on User @argumentDefinitions(showEmail: {type: "Boolean!"}) {
              id
              name
            }

            query GetUser {
              user(id: "1") {
                posts {
                  author {
                    ...UserFields
                  }
                }
              }
            }
          `)
        }
      ];

      const config: FragmentArgumentLinterConfig = {};
      
      expect(() => {
        plugin(schema, documents, config);
      }).toThrow('must have @arguments directive');
    });
  });

  describe('複数フラグメントの処理', () => {
    test('複数のフラグメントをそれぞれ検証する', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            fragment UserBasic on User @argumentDefinitions {
              id
            }

            fragment PostBasic on Post @argumentDefinitions {
              id
            }

            query GetData {
              user(id: "1") {
                ...UserBasic @arguments
              }
              post(id: "1") {
                ...PostBasic @arguments
              }
            }
          `)
        }
      ];

      const config: FragmentArgumentLinterConfig = {};
      const result = plugin(schema, documents, config);

      expect(result).toContain('No issues found');
    });

    test('複数のエラーをすべて報告する', () => {
      const documents = [
        {
          location: 'test.graphql',
          document: parse(`
            fragment UserBasic on User {
              id
            }

            fragment PostBasic on Post {
              id
            }

            query GetData {
              user(id: "1") {
                ...UserBasic
              }
              post(id: "1") {
                ...PostBasic
              }
            }
          `)
        }
      ];

      const config: FragmentArgumentLinterConfig = {
        requireArgumentDefinitions: true
      };
      
      expect(() => {
        plugin(schema, documents, config);
      }).toThrow('2 error(s)');
    });
  });
});
