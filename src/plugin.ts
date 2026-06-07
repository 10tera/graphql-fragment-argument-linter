import { PluginFunction } from '@graphql-codegen/plugin-helpers';
import { ValidationIssue } from './types';
import { FragmentArgumentAnalyzer } from './fragmentArgumentAnalyzer';

/**
 * The main plugin function for GraphQL Code Generator
 */
export const plugin: PluginFunction<
  {},
  string
> = (
  _schema,
  documents,
  _config,
) => {
  const fragmentArgumentAnalyzer = new FragmentArgumentAnalyzer(documents);

  const issues = fragmentArgumentAnalyzer.getIssues();
  const stats = fragmentArgumentAnalyzer.getStats();

  const errors = issues.filter(i => i.level === 'error');
  if (errors.length > 0) {
    throw new Error(`Fragment Argument Linter failed with ${errors.length} error(s):\n\n${generateReport(issues, stats)}`);
  }

  console.log(generateReport(issues, stats));
  return '';
};

/**
 * Generate a formatted report from validation issues
 */
const generateReport = (
  issues: ValidationIssue[],
  stats: {  issuedFragmentsCount: number; issuesCount: number }
): string => {
  const lines: string[] = [];

  lines.push('# GraphQL Fragment Argument Linter Report');
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Fragments with issues: ${stats.issuedFragmentsCount}`);
  lines.push(`- Total issues: ${stats.issuesCount}`);
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
};

/**
 * Get an icon for the issue level
 */
const getIconForLevel = (level: 'error' | 'warning' | 'info'): string => {
  switch (level) {
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
  }
};

