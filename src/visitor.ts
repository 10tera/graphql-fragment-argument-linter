import { GraphQLSchema, FragmentDefinitionNode, FragmentSpreadNode } from 'graphql';
import { LoadedFragment } from '@graphql-codegen/visitor-plugin-common';
import { FragmentArgumentLinterConfig, ValidationIssue, FragmentArgumentDefinition, FragmentArgument } from './types';
import { DIRECTIVE_FRAGMENT_ARGUMENT_DEFINITIONS, DIRECTIVE_FRAGMENT_ARGUMENTS } from './constants/directive';
import { parseArgumentDefinitions } from './utils/argumentDefinitionsParser';
import { parseArguments } from './utils/argumentsParser';
import { validateArgumentMatch } from './utils/argumentValidator';

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
  private fragmentDefinitions = new Map<string, { 
    hasArgumentDefinitions: true; 
    node: FragmentDefinitionNode;
    arguments: FragmentArgumentDefinition[];
  } | {
    hasArgumentDefinitions: false; 
    node: FragmentDefinitionNode;
    arguments: null;
  }>();
  /**
   * 全てのfragmentの呼び出し箇所
   */
  private fragmentSpreads: Array<{ 
    fragmentName: string; 
    hasArguments: true; 
    node: FragmentSpreadNode;
    arguments: FragmentArgument[];
  } | {
    fragmentName: string; 
    hasArguments: false; 
    node: FragmentSpreadNode;
    arguments: null;
  }> = [];

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
    const argumentDefinitionsDirective = fragmentDefinition.directives?.find(
      directive => directive.name.value === DIRECTIVE_FRAGMENT_ARGUMENT_DEFINITIONS
    );
    
    // Parse arguments using utility
    if (argumentDefinitionsDirective) {
      const result = parseArgumentDefinitions(argumentDefinitionsDirective);
      if (result.errors.length > 0) {
        for (const error of result.errors) {
          this.addIssue({
            level: 'error',
            message: error.message,
            fragmentName,
            location: fragmentDefinition.loc ? {
              line: fragmentDefinition.loc.startToken.line,
              column: fragmentDefinition.loc.startToken.column
            } : undefined
          });
        }
      }
       // fragmentの情報と、@argumentDefinitionsの有無を保存
    this.fragmentDefinitions.set(fragmentName, {
      hasArgumentDefinitions: true ,
      node: fragmentDefinition,
      arguments: result.args
    });
    }
    else{
      // fragmentの情報と、@argumentDefinitionsの有無を保存
    this.fragmentDefinitions.set(fragmentName, {
      hasArgumentDefinitions:  false,
      node: fragmentDefinition,
      arguments: null
    });
    }

    // // @argumentDefinitionsが必要な場合、@argumentDefinitionsがない場合はエラー
    // if (this.config.requireArgumentDefinitions && !argumentDefinitionsDirective) {
    //   this.addIssue({
    //     level: 'error',
    //     message: `Fragment "${fragmentName}" must have @argumentDefinitions directive`,
    //     fragmentName,
    //     location: fragmentDefinition.loc ? {
    //       line: fragmentDefinition.loc.startToken.line,
    //       column: fragmentDefinition.loc.startToken.column
    //     } : undefined
    //   });
    // }
  }

  /**
   * Collect a fragment spread (fragment usage)
   * NOTE: 全てのfragmentの呼び出し箇所を収集し、@argumentsをパース
   */
  public collectFragmentSpread(fragmentSpread: FragmentSpreadNode): void {
    const fragmentName = fragmentSpread.name.value;
    const argumentsDirective = fragmentSpread.directives?.find(
      directive => directive.name.value === DIRECTIVE_FRAGMENT_ARGUMENTS
    );

    // Parse arguments if present
    if (argumentsDirective) {
      const result = parseArguments(argumentsDirective);
      if (result.errors.length > 0) {
        for (const error of result.errors) {
          this.addIssue({
            level: 'error',
            message: error.message,
            fragmentName,
            location: fragmentSpread.loc ? {
              line: fragmentSpread.loc.startToken.line,
              column: fragmentSpread.loc.startToken.column
            } : undefined
          });
        }
      }
    this.fragmentSpreads.push({
      fragmentName,
      hasArguments: true,
      node: fragmentSpread,
      arguments: result.args
    });
    }
    else{
      this.fragmentSpreads.push({
        fragmentName,
        hasArguments: false,
        node: fragmentSpread,
        arguments: null
      });
    }
  }

  /**
   * Validate fragment spreads against their definitions
   * 1. @argumentDefinitionsがあるfragmentにおいて、@argumentsがない場合はエラー
   * 2. @argumentDefinitionsがないfragmentにおいて、@argumentsがある場合はエラー
   * 3. 両方ある場合、引数のマッチングを検証
   */
  public validateFragmentSpreads(): void {
    for (const spread of this.fragmentSpreads) {
      const definition = this.fragmentDefinitions.get(spread.fragmentName);
      
      if (!definition) {
        throw new Error(`Fragment definition not found for ${spread.fragmentName}`);
      }

      // Case 1: Fragment has @argumentDefinitions but spread doesn't have @arguments
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
      // Case 2: Fragment doesn't have @argumentDefinitions but spread has @arguments
      if (!definition.hasArgumentDefinitions && spread.hasArguments) {
        this.addIssue({
          level: 'error',
          message: `Fragment spread "${spread.fragmentName}" has @arguments directive but the fragment does not define @argumentDefinitions`,
          fragmentName: spread.fragmentName,
          location: spread.node.loc ? {
            line: spread.node.loc.startToken.line,
            column: spread.node.loc.startToken.column
          } : undefined
        });
      }
      // Case 3: Both have directives - validate argument match
      if (definition.hasArgumentDefinitions && spread.hasArguments) {
        // Use already parsed arguments from collectFragmentSpread
        if (spread.arguments.length > 0 && definition.arguments.length > 0) {
          const validationErrors = validateArgumentMatch(
            definition.arguments,
            spread.arguments,
            spread.fragmentName
          );

          for (const error of validationErrors) {
            this.addIssue({
              level: 'error',
              message: error.message,
              fragmentName: spread.fragmentName,
              location: spread.node.loc ? {
                line: spread.node.loc.startToken.line,
                column: spread.node.loc.startToken.column
              } : undefined
            });
          }
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
      fragmentsWithIssues: this.fragmentsWithIssues.size,
      totalIssues: this.issues.length
    };
  }
}

