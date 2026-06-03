import { Types } from "@graphql-codegen/plugin-helpers";
import { FragmentDefinitionNode, FragmentSpreadNode, visit } from "graphql";
import { DIRECTIVE_FRAGMENT_ARGUMENT_DEFINITIONS, DIRECTIVE_FRAGMENT_ARGUMENTS } from "./constants/directive";
import { parseArgumentDefinitions } from "./utils/argumentDefinitionsParser";
import { FragmentArgument, FragmentArgumentDefinition, ValidationIssue } from "./types";
import { parseArguments } from "./utils/argumentsParser";

export class FragmentArgumentAnalyzer {
    private fragments = new Map<string, {
        node: FragmentDefinitionNode;
        /**
         * - null: @ argumentDefinitionsがない
         * - FragmentArgumentDefinition[]: @ argumentDefinitionsがある
         */
        argumentDefinition: FragmentArgumentDefinition[] | null;
    }>();

    private fragmentSpreads : {
        name:string;
        node: FragmentSpreadNode;
        /**
         * - null: @ argumentsがない
         * - FragmentArgument[]: @ argumentsがある
         */
        arguments: FragmentArgument[] | null;
    }[] = []

    private issues: ValidationIssue[] = [];
    private issuedFragments = new Set<string>();

    constructor(
        documents: Types.DocumentFile[]
    ){
        this.collectFragmentData(documents);
    }

    private addIssue(issue: ValidationIssue): void {
        this.issues.push(issue);
        this.issuedFragments.add(issue.fragmentName);
      }

    /**
     * @description 全てのfragmentの定義と呼び出し箇所を収集し、同時に@argumentDefinitionsと@argumentsをパースして保存
     */
    private collectFragmentData(documents: Types.DocumentFile[]): void {
        for(const document of documents){
            if(!document.document) continue;
            visit(document.document, {
                FragmentDefinition: (node) => {
                    const argumentDefinitionsDirective = node.directives?.find(
                        directive => directive.name.value === DIRECTIVE_FRAGMENT_ARGUMENT_DEFINITIONS
                    );
                    if(argumentDefinitionsDirective){
                        const result = parseArgumentDefinitions(argumentDefinitionsDirective);
                        if(result.errors.length > 0){
                            for(const error of result.errors){
                                this.addIssue({
                                    level: 'error',
                                    message: error.message,
                                    fragmentName:node.name.value,
                                    location: node.loc ? {
                                      line: node.loc.startToken.line,
                                      column: node.loc.startToken.column
                                    } : undefined
                                  });
                            }
                        }
                        this.fragments.set(node.name.value,{
                            node,
                            argumentDefinition: result.args
                        })
                    }
                    else{
                        this.fragments.set(node.name.value,{
                            node,
                            argumentDefinition: null
                        })
                    }
                },
                FragmentSpread: (node) => {
                    const argumentsDirective = node.directives?.find(directive => directive.name.value === DIRECTIVE_FRAGMENT_ARGUMENTS);
                    if(argumentsDirective){
                        const result = parseArguments(argumentsDirective);
                        if(result.errors.length > 0){
                            for(const error of result.errors){
                                this.addIssue({
                                    level: 'error',
                                    message: error.message,
                                    fragmentName:node.name.value,
                                    location: node.loc ? {
                                        line: node.loc.startToken.line,
                                        column: node.loc.startToken.column
                                    } : undefined
                                })
                            }
                        }
                        this.fragmentSpreads.push({
                            name:node.name.value,
                            node,
                            arguments: result.args
                        })
                    }
                    else{
                        this.fragmentSpreads.push({
                            name:node.name.value,
                            node,
                            arguments: null
                        })
                    }
                }
            })
        }
    }

    /**
     * ルール
     * 1. @argumentDefinitionsがあるfragmentを使うときは、@argumentsが必須
     * 2. @argumentDefinitionsがないfragmentを使うときは、@argumentsが禁止
     * 3. @argumentsのそれぞれの引数名は、@argumentDefinitionsの引数名のどれかに一致しなければならない
     */
    private validateFragmentSpreads(
        spread: {
            name:string;
            node: FragmentSpreadNode;
            arguments: FragmentArgument[] | null;
        }
    ) {
        const fragment = this.fragments.get(spread.name)
        if(!fragment){
            // そもそもpluginが呼ばれる前にエラーになるはず
            throw new Error(`Fragment definition not found for ${spread.name}`);
        }
        const hasArgumentDefinitions = fragment.argumentDefinition !== null;
        const hasArguments = spread.arguments !== null;

        // ルール1
        if(hasArgumentDefinitions && !hasArguments){
            this.addIssue({
                level: "error",
                message: `Fragment spread "${spread.name}" must have @arguments directive because the fragment defines @argumentDefinitions`,
                fragmentName: spread.name,
                location: spread.node.loc ? {
                    line: spread.node.loc.startToken.line,
                    column: spread.node.loc.startToken.column
                } : undefined
            })
        }
        // ルール2
        if(!hasArgumentDefinitions && hasArguments){
            this.addIssue({
                level: "error",
                message: `Fragment spread "${spread.name}" must not have @arguments directive because the fragment does not define @argumentDefinitions`,
                fragmentName: spread.name,
                location: spread.node.loc ? {
                    line: spread.node.loc.startToken.line,
                    column: spread.node.loc.startToken.column
                } : undefined
            })
        }
    }

    public getIssues(): ValidationIssue[] {
        return this.issues;
    }

    public getStats() {
        return {
            issuedFragmentsCount: this.issuedFragments.size,
            issuesCount: this.issues.length
        };
    }
}