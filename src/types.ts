/**
 * Configuration options for the Fragment Argument Linter plugin
 */
export interface FragmentArgumentLinterConfig {
  /**
   * Require @argumentDefinitions on all fragments
   * @default true
   */
  requireArgumentDefinitions?: boolean;

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
 * Represents a fragment argument
 */
export interface FragmentArgument {
  name: string;
  type?: string;
  defaultValue?: string;
  description?: string;
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

