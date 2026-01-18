import { buildSchema, parse } from 'graphql';
import { plugin } from '../src/plugin';
import { FragmentArgumentLinterConfig } from '../src/types';
import { describe, test, expect } from 'vitest';

describe('Fragment Argument Linter Plugin', () => {
  const schema = buildSchema(`
    type Query {
      user(id: ID!): User
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

  test('should generate a report for documents without fragments', () => {
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
    const result = plugin(schema, documents, config, {});

    expect(result).toContain('Fragment Argument Linter Report');
    expect(result).toContain('Fragments checked: 0');
    expect(result).toContain('No issues found');
  });

  test('should validate fragments in documents', () => {
    const documents = [
      {
        location: 'test.graphql',
        document: parse(`
          fragment UserFields on User {
            id
            name
            email
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
    const result = plugin(schema, documents, config, {});

    expect(result).toContain('Fragment Argument Linter Report');
    expect(result).toContain('Fragments checked: 1');
  });

  test('should enforce strict mode naming conventions', () => {
    const documents = [
      {
        location: 'test.graphql',
        document: parse(`
          fragment userFields on User {
            id
            name
          }
        `)
      }
    ];

    const config: FragmentArgumentLinterConfig = {
      strictMode: true
    };
    const result = plugin(schema, documents, config, {});

    expect(result).toContain('Fragment Argument Linter Report');
    expect(result).toContain('Fragments checked: 1');
  });

  test('should ignore specified fragments', () => {
    const documents = [
      {
        location: 'test.graphql',
        document: parse(`
          fragment IgnoredFragment on User {
            id
          }

          fragment CheckedFragment on User {
            name
          }
        `)
      }
    ];

    const config: FragmentArgumentLinterConfig = {
      ignoreFragments: ['IgnoredFragment']
    };
    const result = plugin(schema, documents, config, {});

    expect(result).toContain('Fragments checked: 2');
  });

  test('should handle multiple fragments across multiple documents', () => {
    const documents = [
      {
        location: 'user.graphql',
        document: parse(`
          fragment UserBasic on User {
            id
            name
          }
        `)
      },
      {
        location: 'post.graphql',
        document: parse(`
          fragment PostBasic on Post {
            id
            title
          }
        `)
      }
    ];

    const config: FragmentArgumentLinterConfig = {};
    const result = plugin(schema, documents, config, {});

    expect(result).toContain('Fragments checked: 2');
  });

  test('should apply custom validation rules', () => {
    const documents = [
      {
        location: 'test.graphql',
        document: parse(`
          fragment TestFragment on User {
            id
            name
          }
        `)
      }
    ];

    const config: FragmentArgumentLinterConfig = {
      customRules: [
        {
          name: 'test-rule',
          validate: (fragmentName, args) => {
            return [
              {
                level: 'warning',
                message: 'Custom rule triggered',
                fragmentName
              }
            ];
          }
        }
      ]
    };
    const result = plugin(schema, documents, config, {});

    expect(result).toContain('Custom rule triggered');
    expect(result).toContain('WARNING');
  });

  test('should generate summary with correct statistics', () => {
    const documents = [
      {
        location: 'test.graphql',
        document: parse(`
          fragment Fragment1 on User {
            id
          }
          
          fragment Fragment2 on Post {
            id
          }
        `)
      }
    ];

    const config: FragmentArgumentLinterConfig = {
      customRules: [
        {
          name: 'test-rule',
          validate: (fragmentName) => [
            {
              level: 'error',
              message: 'Test error',
              fragmentName
            }
          ]
        }
      ]
    };
    const result = plugin(schema, documents, config, {});

    expect(result).toContain('Fragments checked: 2');
    expect(result).toContain('Fragments with issues: 2');
    expect(result).toContain('Total issues: 2');
  });
});

