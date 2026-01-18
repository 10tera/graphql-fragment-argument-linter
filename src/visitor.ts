import { GraphQLSchema } from 'graphql';
import {
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  LoadedFragment
} from '@graphql-codegen/visitor-plugin-common';
import { FragmentArgumentLinterConfig, ValidationIssue, FragmentArgument } from './types';

/**
 * Visitor class for analyzing GraphQL fragments and their arguments
 */
export class FragmentArgumentVisitor extends ClientSideBaseVisitor<
  ClientSideBasePluginConfig,
  FragmentArgumentLinterConfig
> {
  private issues: ValidationIssue[] = [];
  private fragmentsChecked = 0;
  private fragmentsWithIssues = new Set<string>();

  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    config: FragmentArgumentLinterConfig
  ) {
    super(schema, fragments, config, {});
  }

  /**
   * Validate a fragment definition
   */
  public validateFragment(fragmentName: string, fragmentDefinition: any): void {
    this.fragmentsChecked++;

    // Check if this fragment should be ignored
    if (this.config.ignoreFragments?.includes(fragmentName)) {
      return;
    }

    const args = this.extractFragmentArguments(fragmentDefinition);

    // Validate based on configuration
    if (this.config.requireExplicitTypes !== false) {
      this.validateExplicitTypes(fragmentName, args);
    }

    if (this.config.requireDocumentation) {
      this.validateDocumentation(fragmentName, args);
    }

    if (this.config.strictMode) {
      this.validateStrictMode(fragmentName, args);
    }

    // Apply custom rules if any
    if (this.config.customRules) {
      for (const rule of this.config.customRules) {
        const ruleIssues = rule.validate(fragmentName, args);
        this.issues.push(...ruleIssues);
        if (ruleIssues.length > 0) {
          this.fragmentsWithIssues.add(fragmentName);
        }
      }
    }
  }

  /**
   * Extract arguments from a fragment definition
   */
  private extractFragmentArguments(fragmentDefinition: any): FragmentArgument[] {
    const args: FragmentArgument[] = [];

    // Note: GraphQL fragments don't natively support arguments in the spec
    // This is a placeholder for custom argument syntax or directives
    // You would extend this based on your specific implementation
    
    // Example: Looking for @argumentDefinitions directive (Relay-style)
    if (fragmentDefinition.directives) {
      for (const directive of fragmentDefinition.directives) {
        if (directive.name?.value === 'argumentDefinitions') {
          // Extract argument definitions from the directive
          // This is a simplified example
          args.push({
            name: 'exampleArg',
            type: 'String'
          });
        }
      }
    }

    return args;
  }

  /**
   * Validate that all arguments have explicit types
   */
  private validateExplicitTypes(fragmentName: string, args: FragmentArgument[]): void {
    for (const arg of args) {
      if (!arg.type) {
        this.addIssue({
          level: 'error',
          message: `Fragment argument "${arg.name}" must have an explicit type`,
          fragmentName
        });
      }
    }
  }

  /**
   * Validate that all arguments have documentation
   */
  private validateDocumentation(fragmentName: string, args: FragmentArgument[]): void {
    for (const arg of args) {
      if (!arg.description) {
        this.addIssue({
          level: 'warning',
          message: `Fragment argument "${arg.name}" should have documentation`,
          fragmentName
        });
      }
    }
  }

  /**
   * Validate strict mode requirements
   */
  private validateStrictMode(fragmentName: string, args: FragmentArgument[]): void {
    // In strict mode, fragments with arguments must follow naming conventions
    if (args.length > 0) {
      // Check fragment name follows convention (e.g., PascalCase)
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(fragmentName)) {
        this.addIssue({
          level: 'error',
          message: `Fragment "${fragmentName}" with arguments must use PascalCase naming`,
          fragmentName
        });
      }

      // Check that arguments follow naming convention (e.g., camelCase)
      for (const arg of args) {
        if (!/^[a-z][a-zA-Z0-9]*$/.test(arg.name)) {
          this.addIssue({
            level: 'error',
            message: `Fragment argument "${arg.name}" must use camelCase naming`,
            fragmentName
          });
        }
      }
    }
  }

  /**
   * Add a validation issue
   */
  private addIssue(issue: ValidationIssue): void {
    this.issues.push(issue);
    this.fragmentsWithIssues.add(issue.fragmentName);
  }

  /**
   * Get all validation issues
   */
  public getIssues(): ValidationIssue[] {
    return this.issues;
  }

  /**
   * Get statistics about the linting process
   */
  public getStats() {
    return {
      fragmentsChecked: this.fragmentsChecked,
      fragmentsWithIssues: this.fragmentsWithIssues.size,
      totalIssues: this.issues.length
    };
  }
}

