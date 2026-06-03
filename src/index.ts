/**
 * GraphQL Fragment Argument Linter Plugin
 * 
 * A GraphQL Code Generator plugin for validating fragment arguments
 * and enforcing best practices.
 */

export { plugin } from './plugin';
export type {
  FragmentArgumentLinterConfig,
  // CustomRule,
  FragmentArgumentDefinition as FragmentArgument,
  ValidationIssue,
  LintResult
} from './types';

