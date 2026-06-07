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

