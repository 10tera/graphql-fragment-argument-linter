import { DirectiveNode,parseType } from 'graphql';
import { FragmentArgumentDefinition, ParseError, ParseResult } from '../types';

export const isValidGraphQLType = (type: string): boolean => {
  try {
    parseType(type);
    return true;
  } catch {
    return false;
  }
};

/**
 * Parse @argumentDefinitions directive from a fragment definition
 */
export const parseArgumentDefinitions = (
  directive: DirectiveNode
) :ParseResult<FragmentArgumentDefinition[]>=> {
  const errors: ParseError[] = [];
  const args: FragmentArgumentDefinition[] = [];

  for (const arg of directive.arguments ?? []) {
    const argName = arg.name.value;
    const argValue = arg.value;

    // Must be ObjectValue
    if (argValue.kind !== 'ObjectValue') {
      errors.push({
        message: `Argument "${argName}" must be an object with {type: "..."}`,
      });
      continue;
    }

    // Extract type field
    const typeField = argValue.fields.find(f => f.name.value === 'type');
    if (!typeField || typeField.value.kind !== 'StringValue') {
      errors.push({
        message: `Argument "${argName}" must have a "type" field with string value`,
      });
      continue;
    }

    // Validate GraphQL type syntax
    const typeValue = typeField.value.value;
    if (!isValidGraphQLType(typeValue)) {
      errors.push({
        message: `Argument "${argName}" has invalid type "${typeValue}"`,
      });
      continue;
    }

    args.push({
      name: argName,
      type: typeValue
    });
  }

  return { args, errors };
};