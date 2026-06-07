import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './schema.graphql',
  documents: ['./operations/**/*.graphql'],
  generates: {
    './generated/types.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
       // 'graphql-codegen-fragment-argument-linter',
      ],
    },
  },
};

export default config;
