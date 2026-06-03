/**
 * Configuration options for the Fragment Argument Linter plugin
 */
export interface FragmentArgumentLinterConfig {
  // /**
  //  * Require @argumentDefinitions on all fragments
  //  * @default true
  //  */
  // requireArgumentDefinitions?: boolean;

  // /**
  //  * Enable strict mode for fragment argument validation
  //  * @default false
  //  */
  // strictMode?: boolean;

  // /**
  //  * List of fragment names to ignore during validation
  //  * @default []
  //  */
  // ignoreFragments?: string[];

  // /**
  //  * Require all fragment arguments to have explicit types
  //  * @default true
  //  */
  // requireExplicitTypes?: boolean;

  // /**
  //  * Require documentation for fragment arguments
  //  * @default false
  //  */
  // requireDocumentation?: boolean;

  // /**
  //  * Custom validation rules (for future extension)
  //  */
  // customRules?: CustomRule[];
}

// /**
//  * Custom validation rule interface (for future extension)
//  */
// export interface CustomRule {
//   name: string;
//   validate: (fragmentName: string, args: FragmentArgument[]) => ValidationIssue[];
// }

/**
/**
 * Represents a fragment argument.
 * 
 * For example:
 *   userID: { type: "ID" }
 * 
 * - "userID" is the argument name.
 * - "type" specifies the GraphQL type of the argument (e.g., "ID", "String!", etc.).
 */
export interface FragmentArgumentDefinition {
  name: string;
  type: string;
}

/**
 * Represents an argument value passed to a fragment spread
 * For example:
 *   @arguments(userId: $userId)
 * 
 * - "userId" is the argument name.
 * - "$userId" is the variable reference.
 */
export interface FragmentArgument {
  name: string;
  value: string;
}

/**
 * Represents a parse error
 */
export interface ParseError {
  message: string;
}

/**
 * Result of parsing operation
 */
export interface ParseResult<T> {
  args: T;
  errors: ParseError[];
}

/**
 * Represents a validation issue found during linting
 */
export interface ValidationIssue {
  level: 'error'// | 'warning' | 'info';
  message: string;
  fragmentName: string;
  location?: {
    line: number;
    column: number;
  };
}

/**
 * Result of the linting process
 */
export interface LintResult {
  issues: ValidationIssue[];
  fragmentsChecked: number;
  fragmentsWithIssues: number;
}

