import { buildSchema, parse } from 'graphql';
import { FragmentArgumentVisitor } from '../src/visitor';
import { describe, test, expect } from 'vitest';

describe('FragmentArgumentVisitor', () => {
  const schema = buildSchema(`
    type Query {
      user(id: ID!): User
    }

    type User {
      id: ID!
      name: String!
      email: String!
    }
  `);

  describe('validateFragment', () => {
    test('requireArgumentDefinitions が false の場合、@argumentDefinitions がなくてもエラーにならない', () => {
      const document = parse(`
        fragment UserFields on User {
          id
          name
        }
      `);

      const fragment = document.definitions[0] as any;
      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: false
      });

      visitor.validateFragment('UserFields', fragment);

      const issues = visitor.getIssues();
      expect(issues).toHaveLength(0);
    });

    test('requireArgumentDefinitions が true の場合、@argumentDefinitions がないとエラーになる', () => {
      const document = parse(`
        fragment UserFields on User {
          id
          name
        }
      `);

      const fragment = document.definitions[0] as any;
      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: true
      });

      visitor.validateFragment('UserFields', fragment);

      const issues = visitor.getIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0].level).toBe('error');
      expect(issues[0].message).toContain('must have @argumentDefinitions directive');
      expect(issues[0].fragmentName).toBe('UserFields');
    });

    test('@argumentDefinitions がある場合、エラーにならない', () => {
      const document = parse(`
        fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
          id
          name
        }
      `);

      const fragment = document.definitions[0] as any;
      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: true
      });

      visitor.validateFragment('UserFields', fragment);

      const issues = visitor.getIssues();
      expect(issues).toHaveLength(0);
    });

    test('位置情報が正しく記録される', () => {
      const document = parse(`
        fragment UserFields on User {
          id
        }
      `);

      const fragment = document.definitions[0] as any;
      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: true
      });

      visitor.validateFragment('UserFields', fragment);

      const issues = visitor.getIssues();
      expect(issues[0].location).toBeDefined();
      expect(issues[0].location?.line).toBeGreaterThan(0);
      expect(issues[0].location?.column).toBeGreaterThanOrEqual(0);
    });
  });

  describe('collectFragmentSpread', () => {
    test('フラグメントスプレッドを記録する', () => {
      const document = parse(`
        query GetUser {
          user(id: "1") {
            ...UserFields
          }
        }
      `);

      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: false
      });

      // クエリの中からフラグメントスプレッドを探す
      const query = document.definitions[0] as any;
      const spread = query.selectionSet.selections[0].selectionSet.selections[0];

      visitor.collectFragmentSpread(spread);

      // getStats で確認はできないが、内部的に記録されている
      // validateFragmentSpreads で使われるはず
    });

    test('@arguments の有無を正しく記録する', () => {
      const documentWithArgs = parse(`
        query GetUser {
          user(id: "1") {
            ...UserFields @arguments(userId: "1")
          }
        }
      `);

      const documentWithoutArgs = parse(`
        query GetUser {
          user(id: "1") {
            ...UserFields
          }
        }
      `);

      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: false
      });

      // 両方を記録しても問題ないことを確認
      const query1 = documentWithArgs.definitions[0] as any;
      const spread1 = query1.selectionSet.selections[0].selectionSet.selections[0];
      visitor.collectFragmentSpread(spread1);

      const query2 = documentWithoutArgs.definitions[0] as any;
      const spread2 = query2.selectionSet.selections[0].selectionSet.selections[0];
      visitor.collectFragmentSpread(spread2);

      // エラーが起きないことを確認
      expect(visitor.getIssues()).toHaveLength(0);
    });
  });

  describe('validateFragmentSpreads', () => {
    test('@argumentDefinitions があるのに @arguments がない場合、エラーになる', () => {
      const document = parse(`
        fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
          id
          name
        }

        query GetUser {
          user(id: "1") {
            ...UserFields
          }
        }
      `);

      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: true
      });

      const fragment = document.definitions[0] as any;
      const query = document.definitions[1] as any;
      const spread = query.selectionSet.selections[0].selectionSet.selections[0];

      visitor.validateFragment('UserFields', fragment);
      visitor.collectFragmentSpread(spread);
      visitor.validateFragmentSpreads();

      const issues = visitor.getIssues();
      expect(issues.length).toBeGreaterThan(0);
      const spreadIssues = issues.filter(i => i.message.includes('@arguments'));
      expect(spreadIssues).toHaveLength(1);
      expect(spreadIssues[0].message).toContain('must have @arguments directive');
    });

    test('@argumentDefinitions と @arguments が両方ある場合、エラーにならない', () => {
      const document = parse(`
        fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
          id
          name
        }

        query GetUser {
          user(id: "1") {
            ...UserFields @arguments(userId: "1")
          }
        }
      `);

      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: true
      });

      const fragment = document.definitions[0] as any;
      const query = document.definitions[1] as any;
      const spread = query.selectionSet.selections[0].selectionSet.selections[0];

      visitor.validateFragment('UserFields', fragment);
      visitor.collectFragmentSpread(spread);
      visitor.validateFragmentSpreads();

      const issues = visitor.getIssues();
      // @argumentDefinitions の issue はあるかもしれないが、@arguments の issue はない
      const spreadIssues = issues.filter(i => i.message.includes('@arguments'));
      expect(spreadIssues).toHaveLength(0);
    });

    test('@argumentDefinitions がない場合、@arguments がなくてもエラーにならない', () => {
      const document = parse(`
        fragment UserFields on User {
          id
          name
        }

        query GetUser {
          user(id: "1") {
            ...UserFields
          }
        }
      `);

      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: false
      });

      const fragment = document.definitions[0] as any;
      const query = document.definitions[1] as any;
      const spread = query.selectionSet.selections[0].selectionSet.selections[0];

      visitor.validateFragment('UserFields', fragment);
      visitor.collectFragmentSpread(spread);
      visitor.validateFragmentSpreads();

      const issues = visitor.getIssues();
      expect(issues).toHaveLength(0);
    });

    test('@argumentDefinitions がないのに @arguments がある場合、エラーになる', () => {
      const document = parse(`
        fragment UserFields on User {
          id
          name
        }

        query GetUser {
          user(id: "1") {
            ...UserFields @arguments(userId: "1")
          }
        }
      `);

      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: false
      });

      const fragment = document.definitions[0] as any;
      const query = document.definitions[1] as any;
      const spread = query.selectionSet.selections[0].selectionSet.selections[0];

      visitor.validateFragment('UserFields', fragment);
      visitor.collectFragmentSpread(spread);
      visitor.validateFragmentSpreads();

      const issues = visitor.getIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('does not define @argumentDefinitions');
      expect(issues[0].fragmentName).toBe('UserFields');
    });

    test('複数のスプレッドをすべて検証する', () => {
      const document = parse(`
        fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
          id
        }

        query Query1 {
          user(id: "1") {
            ...UserFields
          }
        }

        query Query2 {
          user(id: "2") {
            ...UserFields
          }
        }
      `);

      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: true
      });

      const fragment = document.definitions[0] as any;
      const query1 = document.definitions[1] as any;
      const query2 = document.definitions[2] as any;
      const spread1 = query1.selectionSet.selections[0].selectionSet.selections[0];
      const spread2 = query2.selectionSet.selections[0].selectionSet.selections[0];

      visitor.validateFragment('UserFields', fragment);
      visitor.collectFragmentSpread(spread1);
      visitor.collectFragmentSpread(spread2);
      visitor.validateFragmentSpreads();

      const issues = visitor.getIssues();
      const spreadIssues = issues.filter(i => i.message.includes('@arguments'));
      expect(spreadIssues).toHaveLength(2);
    });
  });

  describe('getIssues / getStats', () => {
    test('Issue がない場合、空配列が返る', () => {
      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: false
      });

      const issues = visitor.getIssues();
      expect(issues).toEqual([]);
    });

    test('統計情報が正しく集計される', () => {
      const document = parse(`
        fragment UserFields on User {
          id
        }

        fragment PostFields on Post {
          id
        }
      `);

      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: true
      });

      const fragment1 = document.definitions[0] as any;
      const fragment2 = document.definitions[1] as any;

      visitor.validateFragment('UserFields', fragment1);
      visitor.validateFragment('PostFields', fragment2);

      const stats = visitor.getStats();
      expect(stats.fragmentsWithIssues).toBe(2);
      expect(stats.totalIssues).toBe(2);
    });

    test('同じフラグメントに複数の Issue がある場合、fragmentsWithIssues は1', () => {
      const document = parse(`
        fragment UserFields on User @argumentDefinitions(userId: {type: "ID!"}) {
          id
        }

        query Query1 {
          user(id: "1") {
            ...UserFields
          }
        }

        query Query2 {
          user(id: "2") {
            ...UserFields
          }
        }
      `);

      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: true
      });

      const fragment = document.definitions[0] as any;
      const query1 = document.definitions[1] as any;
      const query2 = document.definitions[2] as any;
      const spread1 = query1.selectionSet.selections[0].selectionSet.selections[0];
      const spread2 = query2.selectionSet.selections[0].selectionSet.selections[0];

      visitor.validateFragment('UserFields', fragment);
      visitor.collectFragmentSpread(spread1);
      visitor.collectFragmentSpread(spread2);
      visitor.validateFragmentSpreads();

      const stats = visitor.getStats();
      const issues = visitor.getIssues();
      
      // 2つのスプレッドで2つのエラー
      expect(issues.length).toBeGreaterThanOrEqual(2);
      
      // でもフラグメントは1つ
      expect(stats.fragmentsWithIssues).toBe(1);
    });
  });

  describe('addIssue の副作用', () => {
    test('Issue を追加すると fragmentsWithIssues にフラグメント名が追加される', () => {
      const document = parse(`
        fragment UserFields on User {
          id
        }
      `);

      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: true
      });

      const fragment = document.definitions[0] as any;
      visitor.validateFragment('UserFields', fragment);

      const stats = visitor.getStats();
      expect(stats.fragmentsWithIssues).toBe(1);
    });

    test('Issue のレベルが正しく設定される', () => {
      const document = parse(`
        fragment UserFields on User {
          id
        }
      `);

      const visitor = new FragmentArgumentVisitor(schema, [], {
        requireArgumentDefinitions: true
      });

      const fragment = document.definitions[0] as any;
      visitor.validateFragment('UserFields', fragment);

      const issues = visitor.getIssues();
      expect(issues[0].level).toBe('error');
    });
  });
});

