/**
 * GraphQL Fragment Argument Linter Plugin
 * 
 * A GraphQL Code Generator plugin for validating fragment arguments
 * and enforcing best practices.
 */

export { plugin } from './plugin';
export { FragmentArgumentVisitor } from './visitor';
export type {
  FragmentArgumentLinterConfig,
  CustomRule,
  FragmentArgument,
  ValidationIssue,
  LintResult
} from './types';

