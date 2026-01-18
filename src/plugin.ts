import {  FragmentSpreadNode, SelectionSetNode } from 'graphql';
import { PluginFunction } from '@graphql-codegen/plugin-helpers';
import { LoadedFragment } from '@graphql-codegen/visitor-plugin-common';
import { FragmentArgumentLinterConfig, ValidationIssue } from './types';
import { FragmentArgumentVisitor } from './visitor';

/**
 * The main plugin function for GraphQL Code Generator
 */
export const plugin: PluginFunction<
  FragmentArgumentLinterConfig,
  string
> = (
  schema,
  documents,
  config,
) => {
  const configWithDefaults = {
    requireArgumentDefinitions: config.requireArgumentDefinitions ?? true
  } satisfies Required<FragmentArgumentLinterConfig>;


  // Extract fragments from documents
  // NOTE: 全てのfragmentの収集
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
  const visitor = new FragmentArgumentVisitor(schema, allFragments, configWithDefaults);

  // First pass: validate all fragment definitions
  // NOTE: configに従って@argumentDefinitionsが必要なら、その存在チェック
  for (const fragment of allFragments) {
    visitor.validateFragment(fragment.name, fragment.node);
  }

  // Second pass: collect all fragment spreads
  // NOTE: 全てのfragmentの呼び出し箇所を収集
  for (const documentFile of documents) {
    if (documentFile.document) {
      for (const definition of documentFile.document.definitions) {
        if (definition.kind === 'OperationDefinition' || definition.kind === 'FragmentDefinition') {
          // Recursively find fragment spreads in selection set
          const spreads = findFragmentSpreads(definition.selectionSet);
          for (const spread of spreads) {
            visitor.collectFragmentSpread(spread);
          }
        }
      }
    }
  }

  // Third pass: validate fragment spreads against definitions
  // NOTE: @argumentDefinitionsがあるfragmentが、@argumentsがない場合はエラー
  visitor.validateFragmentSpreads();

  // Get validation results
  const issues = visitor.getIssues();
  const stats = visitor.getStats();

  // If there are errors, throw to fail the build
  const errors = issues.filter(i => i.level === 'error');
  if (errors.length > 0) {
    const errorReport = generateReport(issues, stats);
    throw new Error(`Fragment Argument Linter failed with ${errors.length} error(s):\n\n${errorReport}`);
  }

  // Format output
  return generateReport(issues, stats);
};

/**
 * Recursively find all fragment spreads in a selection set
 * 全てのfragmentの呼び出し箇所を収集
 */
function findFragmentSpreads(selectionSet: SelectionSetNode): FragmentSpreadNode[] {
  const spreads: FragmentSpreadNode[] = [];
  
  if (!selectionSet || !selectionSet.selections) {
    return spreads;
  }

  for (const selection of selectionSet.selections) {
    if (selection.kind === 'FragmentSpread') {
      spreads.push(selection);
      continue
    }
    if (selection.selectionSet) {
      spreads.push(...findFragmentSpreads(selection.selectionSet));
    }
  }

  return spreads;
}

/**
 * Generate a formatted report from validation issues
 */
function generateReport(
  issues: ValidationIssue[],
  stats: {  fragmentsWithIssues: number; totalIssues: number }
): string {
  const lines: string[] = [];

  lines.push('# GraphQL Fragment Argument Linter Report');
  lines.push('');
  lines.push('## Summary');
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

