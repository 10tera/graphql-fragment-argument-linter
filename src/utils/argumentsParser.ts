import { DirectiveNode } from 'graphql';
import { FragmentArgument, ParseResult, ParseError } from '../types';
/**
 * Parse @arguments directive from a fragment spread
 */
export const parseArguments = (
  directive: DirectiveNode
): ParseResult<FragmentArgument[]> => {
  const errors: ParseError[] = [];
  const args: FragmentArgument[] = [];

  for (const arg of directive.arguments ?? []) {
    const argName = arg.name.value;
    const argValue = arg.value;

    // Must be Variable
    if (argValue.kind !== 'Variable') {
      errors.push({
        message: `Argument "${argName}" must be a variable reference`,
      });
      continue;
    }

    args.push({
      name: argName,
      value: argValue.name.value
    });
  }

  return {  args, errors };
};

