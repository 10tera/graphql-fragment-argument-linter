import { FragmentArgumentDefinition, FragmentArgument, ParseError } from '../types';

/**
 * Validate that passed arguments match the defined arguments
 */
export const validateArgumentMatch = (
  definedArgs: FragmentArgumentDefinition[],
  passedArgs: FragmentArgument[],
  fragmentName: string
): ParseError[] => {
  const errors: ParseError[] = [];

  // Check: All passed arguments are defined
  for (const passedArg of passedArgs) {
    const defined = definedArgs.find(d => d.name === passedArg.name);
    
    if (!defined) {
      errors.push({
        message: `Argument "${passedArg.name}" is not defined in fragment "${fragmentName}"`,
        argumentName: passedArg.name
      });
    }
  }

  // Check: All required arguments are passed (all args are required since no defaultValue)
  for (const definedArg of definedArgs) {
    const passed = passedArgs.find(p => p.name === definedArg.name);
    if (!passed) {
      errors.push({
        message: `Required argument "${definedArg.name}" is missing in fragment spread "${fragmentName}"`,
        argumentName: definedArg.name
      });
    }
  }

  return errors;
};

