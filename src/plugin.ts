import { GraphQLSchema } from 'graphql';
import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import { LoadedFragment, RawClientSideBasePluginConfig } from '@graphql-codegen/visitor-plugin-common';
import { FragmentArgumentLinterConfig, ValidationIssue } from './types';
import { FragmentArgumentVisitor } from './visitor';

/**
 * The main plugin function for GraphQL Code Generator
 */
export const plugin: PluginFunction<
  FragmentArgumentLinterConfig,
  string
> = (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: FragmentArgumentLinterConfig
) => {
  // Extract fragments from documents
  const allFragments: LoadedFragment[] = [];
  
  for (const documentFile of documents) {
    if (documentFile.document) {
      for (const definition of documentFile.document.definitions) {
        if (definition.kind === 'FragmentDefinition') {
          allFragments.push({
            node: definition,
            name: definition.name.value,
            onType: definition.typeCondition.name.value,
            isExternal: false
          });
        }
      }
    }
  }

  // Create visitor and validate fragments
  const visitor = new FragmentArgumentVisitor(schema, allFragments, config);

  for (const fragment of allFragments) {
    visitor.validateFragment(fragment.name, fragment.node);
  }

  // Get validation results
  const issues = visitor.getIssues();
  const stats = visitor.getStats();

  // Format output
  return generateReport(issues, stats);
};

/**
 * Generate a formatted report from validation issues
 */
function generateReport(
  issues: ValidationIssue[],
  stats: { fragmentsChecked: number; fragmentsWithIssues: number; totalIssues: number }
): string {
  const lines: string[] = [];

  lines.push('# GraphQL Fragment Argument Linter Report');
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Fragments checked: ${stats.fragmentsChecked}`);
  lines.push(`- Fragments with issues: ${stats.fragmentsWithIssues}`);
  lines.push(`- Total issues: ${stats.totalIssues}`);
  lines.push('');

  if (issues.length === 0) {
    lines.push('✅ No issues found! All fragments are valid.');
    return lines.join('\n');
  }

  // Group issues by fragment
  const issuesByFragment = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    const fragmentIssues = issuesByFragment.get(issue.fragmentName) || [];
    fragmentIssues.push(issue);
    issuesByFragment.set(issue.fragmentName, fragmentIssues);
  }

  lines.push('## Issues Found');
  lines.push('');

  // Sort fragments alphabetically
  const sortedFragmentNames = Array.from(issuesByFragment.keys()).sort();

  for (const fragmentName of sortedFragmentNames) {
    const fragmentIssues = issuesByFragment.get(fragmentName)!;
    lines.push(`### Fragment: ${fragmentName}`);
    lines.push('');

    for (const issue of fragmentIssues) {
      const icon = getIconForLevel(issue.level);
      const location = issue.location
        ? ` (line ${issue.location.line}, column ${issue.location.column})`
        : '';
      lines.push(`${icon} **${issue.level.toUpperCase()}**: ${issue.message}${location}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get an icon for the issue level
 */
function getIconForLevel(level: 'error' | 'warning' | 'info'): string {
  switch (level) {
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
  }
}

