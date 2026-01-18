import { GraphQLSchema, FragmentDefinitionNode, FragmentSpreadNode } from 'graphql';
import { LoadedFragment } from '@graphql-codegen/visitor-plugin-common';
import { FragmentArgumentLinterConfig, ValidationIssue, FragmentArgument } from './types';
import { DIRECTIVE_FRAGMENT_ARGUMENT_DEFINITIONS, DIRECTIVE_FRAGMENT_ARGUMENTS } from './constants/directive';

/**
 * Visitor class for analyzing GraphQL fragments and their arguments
 */
export class FragmentArgumentVisitor {
  /**
   * 全てのエラーのリスト
   */
  private issues: ValidationIssue[] = [];
  /**
   * エラーがあるfragmentのリスト（重複を排除）
   */
  private fragmentsWithIssues = new Set<string>();
  /**
   * 全てのfragmentの定義
   */
  private fragmentDefinitions = new Map<string, { hasArgumentDefinitions: boolean; node: FragmentDefinitionNode }>();
  /**
   * 全てのfragmentの呼び出し箇所
   */
  private fragmentSpreads: Array<{ fragmentName: string; hasArguments: boolean; node: FragmentSpreadNode }> = [];

  constructor(
    private schema: GraphQLSchema,
    private fragments: LoadedFragment[],
    private config: Required<FragmentArgumentLinterConfig>
  ) {}

  /**
   * Validate a fragment definition
   * config.requireArgumentDefinitionsに従って@argumentDefinitionsが必要なら、その存在チェック
   */
  public validateFragment(fragmentName: string, fragmentDefinition: FragmentDefinitionNode): void {
    // @argumentDefinitionsが存在するかのチェック
    const hasArgumentDefinitions = fragmentDefinition.directives?.some(
      directive => directive.name.value === DIRECTIVE_FRAGMENT_ARGUMENT_DEFINITIONS
    ) ?? false;
    
    // fragmentの情報と、@argumentDefinitionsの有無を保存
    this.fragmentDefinitions.set(fragmentName, {
      hasArgumentDefinitions,
      node: fragmentDefinition
    });

    // @argumentDefinitionsが必要な場合、@argumentDefinitionsがない場合はエラー
    if (this.config.requireArgumentDefinitions && !hasArgumentDefinitions) {
      this.addIssue({
        level: 'error',
        message: `Fragment "${fragmentName}" must have @argumentDefinitions directive`,
        fragmentName,
        location: fragmentDefinition.loc ? {
          line: fragmentDefinition.loc.startToken.line,
          column: fragmentDefinition.loc.startToken.column
        } : undefined
      });
    }

    // ここは後々実装（directiveの詳細を記録するところ）
    // If fragment has @argumentDefinitions, validate its arguments
    // if (hasArgumentDefinitions) {
    //   const args = this.extractFragmentArguments(fragmentDefinition);

    //   // Future: Add more validation here
    //   // - Type validation
    //   // - Documentation validation
    //   // - Custom rules
    // }
  }

  /**
   * Validate a fragment spread (fragment usage)
   * NOTE: 全てのfragmentの呼び出し箇所を収集
   */
  public collectFragmentSpread(fragmentSpread: FragmentSpreadNode): void {
    const fragmentName = fragmentSpread.name.value;
    const hasArguments = fragmentSpread.directives?.some(
      directive => directive.name.value === DIRECTIVE_FRAGMENT_ARGUMENTS
    ) ?? false;

    this.fragmentSpreads.push({
      fragmentName,
      hasArguments,
      node: fragmentSpread
    });
  }

  /**
   * Validate fragment spreads against their definitions
   * @argumentDefinitionsがあるfragmentにおいて、@argumentsがない場合はエラー
   */
  public validateFragmentSpreads(): void {
    for (const spread of this.fragmentSpreads) {
      const definition = this.fragmentDefinitions.get(spread.fragmentName);
      
      if (!definition) {
        throw new Error(`Fragment definition not found for ${spread.fragmentName}`);
      }

      // If fragment has @argumentDefinitions but spread doesn't have @arguments
      if (definition.hasArgumentDefinitions && !spread.hasArguments) {
        this.addIssue({
          level: 'error',
          message: `Fragment spread "${spread.fragmentName}" must have @arguments directive because the fragment defines @argumentDefinitions`,
          fragmentName: spread.fragmentName,
          location: spread.node.loc ? {
            line: spread.node.loc.startToken.line,
            column: spread.node.loc.startToken.column
          } : undefined
        });
      }
    }
  }

  /**
   * Extract arguments from a fragment definition
   */
  private extractFragmentArguments(fragmentDefinition: FragmentDefinitionNode): FragmentArgument[] {
    const args: FragmentArgument[] = [];

    if (!fragmentDefinition.directives) {
      return args;
    }

    for (const directive of fragmentDefinition.directives) {
      if (directive.name.value === DIRECTIVE_FRAGMENT_ARGUMENT_DEFINITIONS) {
        // TODO: Parse @argumentDefinitions directive arguments
        // For now, return placeholder
        args.push({
          name: 'exampleArg',
          type: 'String'
        });
      }
    }

    return args;
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
      fragmentsWithIssues: this.fragmentsWithIssues.size,
      totalIssues: this.issues.length
    };
  }
}

