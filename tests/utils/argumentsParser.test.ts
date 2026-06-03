import { describe, it, expect } from 'vitest';
import { DirectiveNode, parse } from 'graphql';
import { parseArguments } from '../../src/utils/argumentsParser';
import { DIRECTIVE_FRAGMENT_ARGUMENTS } from '../../src/constants/directive';

const getDirective = (source: string): DirectiveNode => {
  const ast = parse(source);
  const operation = ast.definitions[0];
  if (operation.kind !== 'OperationDefinition') throw new Error('Not an operation');
  
  const field = operation.selectionSet.selections[0];
  if (field.kind !== 'Field') throw new Error('Not a field');
  
  const fragmentSpread = field.selectionSet?.selections[0];
  if (!fragmentSpread || fragmentSpread.kind !== 'FragmentSpread') throw new Error('Not a fragment spread');
  
  const directive = fragmentSpread.directives?.find(d => d.name.value === DIRECTIVE_FRAGMENT_ARGUMENTS);
  if (!directive) throw new Error('Directive not found');
  return directive;
};

describe('parseArguments', () => {
  describe('valid arguments', () => {
    it('should parse single variable reference', () => {
      const source = `
        query GetUser($userId: ID!) {
          user {
            ...UserFields @arguments(userId: $userId)
          }
        }
      `;
      const directive = getDirective(source);
      const result = parseArguments(directive);

      expect(result.errors).toEqual([]);
      expect(result.args).toEqual([
        { name: 'userId', value: 'userId' }
      ]);
    });

    it('should parse multiple variable references', () => {
      const source = `
        query GetUser($userId: ID!, $count: Int!, $filter: String) {
          user {
            ...UserFields @arguments(userId: $userId, count: $count, filter: $filter)
          }
        }
      `;
      const directive = getDirective(source);
      const result = parseArguments(directive);

      expect(result.errors).toEqual([]);
      expect(result.args).toEqual([
        { name: 'userId', value: 'userId' },
        { name: 'count', value: 'count' },
        { name: 'filter', value: 'filter' }
      ]);
    });

    it('should handle empty arguments (no parentheses)', () => {
      const source = `
        query GetUser {
          user {
            ...UserFields @arguments
          }
        }
      `;
      const directive = getDirective(source);
      const result = parseArguments(directive);

      expect(result.errors).toEqual([]);
      expect(result.args).toEqual([]);
    });
  });

  describe('invalid arguments', () => {
    it('should return error when argument is not variable', () => {
      for(const arg of ['123', 'true', 'null', '{name: "John"}', '["1", "2", "3"]', 'ACTIVE']){
        const source = `
        query GetUser {
          user {
            ...UserFields @arguments(userId: ${arg})
          }
        }
      `;
      const directive = getDirective(source);
      const result = parseArguments(directive);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Argument "userId" must be a variable reference');
      expect(result.args).toEqual([]);
      }
    });

    it('should collect multiple errors and skip invalid arguments', () => {
      const source = `
        query GetUser($validVar: ID!) {
          user {
            ...UserFields @arguments(
              validArg: $validVar
              invalidArg1: "literal"
              invalidArg2: 123
              anotherValidArg: $validVar
            )
          }
        }
      `;
      const directive = getDirective(source);
      const result = parseArguments(directive);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toContain('invalidArg1');
      expect(result.errors[1].message).toContain('invalidArg2');
      expect(result.args).toEqual([
        { name: 'validArg', value: 'validVar' },
        { name: 'anotherValidArg', value: 'validVar' }
      ]);
    });
  });
});

