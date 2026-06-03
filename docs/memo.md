# 把握メモ

```graphql
fragment List on TodoList
  @argumentDefinitions(
    count: { type: "Int", defaultValue: 10 }
    userID: { type: "ID" }
  )
{
  items(userID: $userID, first: $count) {
    ...
  }
}

query Q($userID: ID!) {
  ...List @arguments(userID: $userID)
}
```
を変換すると



