export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Post = {
  __typename?: 'Post';
  author: User;
  content: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  title: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  post?: Maybe<Post>;
  user?: Maybe<User>;
};


export type QueryPostArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type User = {
  __typename?: 'User';
  email: Scalars['String']['output'];
  friend?: Maybe<User>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  posts: Array<Post>;
};


export type UserFriendArgs = {
  id?: InputMaybe<Scalars['ID']['input']>;
};

export type UserWithFriendFragment = { __typename?: 'User', id: string, name: string, friend?: { __typename?: 'User', id: string, name: string } | null };

export type PostBasicFragment = { __typename?: 'Post', id: string, title: string, content: string };

export type UserDetailFragment = { __typename?: 'User', id: string, name: string, email?: string, friend?: { __typename?: 'User', id: string, name: string } | null };

export type GetUserQueryVariables = Exact<{
  userId: Scalars['ID']['input'];
  friendId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetUserQuery = { __typename?: 'Query', user?: { __typename?: 'User', id: string, name: string, friend?: { __typename?: 'User', id: string, name: string } | null } | null };

export type GetUserDetailQueryVariables = Exact<{
  userId: Scalars['ID']['input'];
  friendId: Scalars['ID']['input'];
  showEmail: Scalars['Boolean']['input'];
}>;


export type GetUserDetailQuery = { __typename?: 'Query', user?: { __typename?: 'User', id: string, name: string, email?: string, friend?: { __typename?: 'User', id: string, name: string } | null } | null };

export type GetPostQueryVariables = Exact<{
  postId: Scalars['ID']['input'];
}>;


export type GetPostQuery = { __typename?: 'Query', post?: { __typename?: 'Post', id: string, title: string, content: string, author: { __typename?: 'User', id: string, name: string } } | null };
