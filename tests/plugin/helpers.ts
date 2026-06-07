import { buildSchema } from 'graphql';
import { FragmentArgumentLinterConfig } from '../../src/types';

export const schema = buildSchema(`
  type Query {
    user(id: ID!): User
    post(id: ID!): Post
  }

  type Mutation {
    updateUser(id: ID!): User
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

export const config: FragmentArgumentLinterConfig = {};
