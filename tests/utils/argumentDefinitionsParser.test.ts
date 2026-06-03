import { describe, it, expect } from 'vitest';
import { DirectiveNode, parse } from 'graphql';
import { parseArgumentDefinitions } from '../../src/utils/argumentDefinitionsParser';
import { DIRECTIVE_FRAGMENT_ARGUMENT_DEFINITIONS } from '../../src/constants/directive';

const getDirective = (source: string): DirectiveNode => {
    const ast = parse(source);
    const fragment = ast.definitions[0];
    if (fragment.kind !== 'FragmentDefinition') throw new Error('Not a fragment');
    
    const directive = fragment.directives?.find(d => d.name.value === DIRECTIVE_FRAGMENT_ARGUMENT_DEFINITIONS);
    if (!directive) throw new Error('Directive not found');
    return directive;
}

describe('parseArgumentDefinitions', () => {
  describe('valid argument definitions', () => {
    it('should parse single argument with valid type', () => {
        for(const type of ["String", "String!", "CustomType", "CustomType!"]){
            const source = `
            fragment UserFields on User @argumentDefinitions(userId: {type: "${type}"}) {
              id
            }
          `;
          const directive = getDirective(source);
          const result = parseArgumentDefinitions(directive);
    
          expect(result.errors).toEqual([]);
          expect(result.args).toEqual([
            { name: 'userId', type: type }
          ]);
        }
    });

    it('should parse multiple arguments', () => {
      const source = `
        fragment UserFields on User @argumentDefinitions(
          userId: {type: "ID!"}
          count: {type: "Int"}
          name: {type: "String!"}
        ) {
          id
        }
      `;
      const directive = getDirective(source);
      const result = parseArgumentDefinitions(directive);

      expect(result.errors).toEqual([]);
      expect(result.args).toEqual([
        { name: 'userId', type: 'ID!' },
        { name: 'count', type: 'Int' },
        { name: 'name', type: 'String!' }
      ]);
    });

    it('should handle empty arguments (no parentheses or empty parentheses)', () => {
      const source = `
        fragment UserFields on User @argumentDefinitions {
          id
        }
      `;
      const directive = getDirective(source);
      const result = parseArgumentDefinitions(directive);

      expect(result.errors).toEqual([]);
      expect(result.args).toEqual([]);
    });
  });

  describe('invalid argument definitions', () => {
    it('should return error when argument is not an object', () => {
      const source = `
        fragment UserFields on User @argumentDefinitions(userId: dummy) {
          id
        }
      `;
      const directive = getDirective(source);
      const result = parseArgumentDefinitions(directive);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Argument "userId" must be an object with {type: "..."}');
      expect(result.args).toEqual([]);
    });

    it('should return error when type field is missing', () => {
      const source = `
        fragment UserFields on User @argumentDefinitions(userId: {value: "123"}) {
          id
        }
      `;
      const directive = getDirective(source);
      const result = parseArgumentDefinitions(directive);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Argument "userId" must have a "type" field with string value');
      expect(result.args).toEqual([]);
    });

    it('should return error when type is not a string', () => {
      const source = `
        fragment UserFields on User @argumentDefinitions(userId: {type: 123}) {
          id
        }
      `;
      const directive = getDirective(source);
      const result = parseArgumentDefinitions(directive);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Argument "userId" must have a "type" field with string value');
      expect(result.args).toEqual([]);
    });

    it('should return error when type value is invalid', () => {
      const source = `
        fragment UserFields on User @argumentDefinitions(
          userId: {type: "id"}
          name: {type: "123Invalid"}
        ) {
          id
        }
      `;
      const directive = getDirective(source);
      const result = parseArgumentDefinitions(directive);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Argument "name" has invalid type "123Invalid"');
      expect(result.args).toEqual([{
        name: "userId",
        type: "id"
      }]);
    });

    it('should collect multiple errors and skip invalid arguments', () => {
      const source = `
        fragment UserFields on User @argumentDefinitions(
          validArg: {type: "ID!"}
          invalidArg1: "NotAnObject"
          invalidArg2: {type: "123InvalidType"}
        ) {
          id
        }
      `;
      const directive = getDirective(source);
      const result = parseArgumentDefinitions(directive);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toContain('invalidArg1');
      expect(result.errors[1].message).toContain('invalidArg2');
      expect(result.args).toEqual([
        { name: 'validArg', type: 'ID!' },
      ]);
    });
  });
});