import { Types } from "@graphql-codegen/plugin-helpers";
import { FragmentDefinitionNode, FragmentSpreadNode, TypeNode, VariableDefinitionNode, parseType, visit } from "graphql";
import { DIRECTIVE_FRAGMENT_ARGUMENT_DEFINITIONS, DIRECTIVE_FRAGMENT_ARGUMENTS } from "./constants/directive";
import { parseArgumentDefinitions } from "./utils/argumentDefinitionsParser";
import { FragmentArgument, FragmentArgumentDefinition, ValidationIssue } from "./types";
import { parseArguments } from "./utils/argumentsParser";
import { validateArgumentMatch } from "./utils/argumentValidator";
import { isTypeCompatible, typeNodeToString } from "./utils/typeCompatibilityChecker";

type FragmentData = {
    node: FragmentDefinitionNode;
    /**
     * - null: @argumentDefinitions がない
     * - FragmentArgumentDefinition[]: @argumentDefinitions がある
     */
    argumentDefinition: FragmentArgumentDefinition[] | null;
    /** selectionSet 内で実際に参照されている変数名の集合 */
    usedVariables: Set<string>;
};

/**
 * FragmentSpread が存在するスコープ
 * - operation: Query / Mutation / Subscription の中
 * - fragment: 別の Fragment 定義の中
 */
type SpreadScope =
    | { kind: 'operation'; variableDefinitions: ReadonlyArray<VariableDefinitionNode> }
    | { kind: 'fragment'; fragmentName: string };

type FragmentSpreadData = {
    name: string;
    node: FragmentSpreadNode;
    /**
     * - null: @arguments がない
     * - FragmentArgument[]: @arguments がある
     */
    arguments: FragmentArgument[] | null;
    scope: SpreadScope;
};

export class FragmentArgumentAnalyzer {
    private fragments = new Map<string, FragmentData>();
    private fragmentSpreads: FragmentSpreadData[] = [];

    private issues: ValidationIssue[] = [];
    private issuedFragments = new Set<string>();

    constructor(documents: Types.DocumentFile[]) {
        this.collectFragmentData(documents);
        this.validate();
    }

    private addIssue(issue: ValidationIssue): void {
        this.issues.push(issue);
        this.issuedFragments.add(issue.fragmentName);
    }

    private locationOf(node: FragmentSpreadNode) {
        return node.loc
            ? { line: node.loc.startToken.line, column: node.loc.startToken.column }
            : undefined;
    }

    /**
     * 全ての fragment 定義と呼び出し箇所を収集し、
     * @argumentDefinitions / @arguments をパースして保存する
     */
    private collectFragmentData(documents: Types.DocumentFile[]): void {
        for (const document of documents) {
            if (!document.document) continue;

            let currentScope: SpreadScope = { kind: 'operation', variableDefinitions: [] };

            visit(document.document, {
                OperationDefinition: {
                    enter: (node) => {
                        currentScope = { kind: 'operation', variableDefinitions: node.variableDefinitions ?? [] };
                    },
                    leave: () => {
                        currentScope = { kind: 'operation', variableDefinitions: [] };
                    },
                },
                FragmentDefinition: {
                    enter: (node) => {
                        currentScope = { kind: 'fragment', fragmentName: node.name.value };

                        const argumentDefinitionsDirective = node.directives?.find(
                            (d) => d.name.value === DIRECTIVE_FRAGMENT_ARGUMENT_DEFINITIONS
                        );
                        const usedVariables = new Set<string>();
                        visit(node.selectionSet, {
                            Variable(varNode) {
                                usedVariables.add(varNode.name.value);
                            },
                        });

                        if (argumentDefinitionsDirective) {
                            const result = parseArgumentDefinitions(argumentDefinitionsDirective);
                            for (const error of result.errors) {
                                this.addIssue({
                                    level: "error",
                                    message: error.message,
                                    fragmentName: node.name.value,
                                    location: node.loc
                                        ? { line: node.loc.startToken.line, column: node.loc.startToken.column }
                                        : undefined,
                                });
                            }
                            this.fragments.set(node.name.value, {
                                node,
                                argumentDefinition: result.args,
                                usedVariables,
                            });
                        } else {
                            this.fragments.set(node.name.value, {
                                node,
                                argumentDefinition: null,
                                usedVariables,
                            });
                        }
                    },
                    leave: () => {
                        currentScope = { kind: 'operation', variableDefinitions: [] };
                    },
                },
                FragmentSpread: (node) => {
                    const argumentsDirective = node.directives?.find(
                        (d) => d.name.value === DIRECTIVE_FRAGMENT_ARGUMENTS
                    );
                    if (argumentsDirective) {
                        const result = parseArguments(argumentsDirective);
                        for (const error of result.errors) {
                            this.addIssue({
                                level: "error",
                                message: error.message,
                                fragmentName: node.name.value,
                                location: this.locationOf(node),
                            });
                        }
                        this.fragmentSpreads.push({
                            name: node.name.value,
                            node,
                            arguments: result.args,
                            scope: currentScope,
                        });
                    } else {
                        this.fragmentSpreads.push({
                            name: node.name.value,
                            node,
                            arguments: null,
                            scope: currentScope,
                        });
                    }
                },
            });
        }
    }

    /**
     * 全ての fragment 定義・スプレッドに対してルールを順に検証する
     */
    private validate(): void {
        for (const [fragmentName, fragment] of this.fragments) {
            this.validateVariableDeclarationMatch(fragmentName, fragment);
        }
        for (const spread of this.fragmentSpreads) {
            const fragment = this.fragments.get(spread.name);
            if (!fragment) {
                // fragment 定義が存在しない場合はプラグイン呼び出し前に GraphQL バリデーションでエラーになるはず
                throw new Error(`Fragment definition not found: ${spread.name}`);
            }
            this.validateArgumentsRequired(spread, fragment);
            this.validateArgumentsForbidden(spread, fragment);
            this.validateArgumentNames(spread, fragment);
            this.validateArgumentTypes(spread, fragment);
        }
    }

    /**
     * @argumentDefinitions を持つ Fragment では、宣言した引数の集合と
     * selectionSet 内で使われている変数の集合が完全一致すること
     */
    private validateVariableDeclarationMatch(fragmentName: string, fragment: FragmentData): void {
        if (fragment.argumentDefinition === null) return;

        const loc = fragment.node.loc
            ? { line: fragment.node.loc.startToken.line, column: fragment.node.loc.startToken.column }
            : undefined;

        for (const varName of fragment.usedVariables) {
            if (!fragment.argumentDefinition.some((d) => d.name === varName)) {
                this.addIssue({
                    level: "error",
                    message: `Fragment "${fragmentName}": variable "$${varName}" is used but not declared in @argumentDefinitions`,
                    fragmentName,
                    location: loc,
                });
            }
        }

        for (const argDef of fragment.argumentDefinition) {
            if (!fragment.usedVariables.has(argDef.name)) {
                this.addIssue({
                    level: "error",
                    message: `Fragment "${fragmentName}": argument "${argDef.name}" is declared in @argumentDefinitions but never used in the fragment body`,
                    fragmentName,
                    location: loc,
                });
            }
        }
    }

    /**
     * @argumentDefinitions があるなら @arguments が必須
     */
    private validateArgumentsRequired(spread: FragmentSpreadData, fragment: FragmentData): void {
        if (fragment.argumentDefinition !== null && spread.arguments === null) {
            this.addIssue({
                level: "error",
                message: `Fragment spread "${spread.name}" must have @arguments directive because the fragment defines @argumentDefinitions`,
                fragmentName: spread.name,
                location: this.locationOf(spread.node),
            });
        }
    }

    /**
     * @argumentDefinitions がないなら @arguments は禁止
     */
    private validateArgumentsForbidden(spread: FragmentSpreadData, fragment: FragmentData): void {
        if (fragment.argumentDefinition === null && spread.arguments !== null) {
            this.addIssue({
                level: "error",
                message: `Fragment spread "${spread.name}" must not have @arguments directive because the fragment does not define @argumentDefinitions`,
                fragmentName: spread.name,
                location: this.locationOf(spread.node),
            });
        }
    }

    /**
     * @arguments の引数名が @argumentDefinitions の引数名と一致すること
     * （どちらかが null の場合はスキップ）
     */
    private validateArgumentNames(spread: FragmentSpreadData, fragment: FragmentData): void {
        if (fragment.argumentDefinition === null || spread.arguments === null) return;

        const errors = validateArgumentMatch(
            fragment.argumentDefinition,
            spread.arguments,
            spread.name
        );
        for (const error of errors) {
            this.addIssue({
                level: "error",
                message: error.message,
                fragmentName: spread.name,
                location: this.locationOf(spread.node),
            });
        }
    }

    /**
     * @arguments で渡す変数の型が @argumentDefinitions の型と互換性があること
     * （どちらかが null の場合はスキップ）
     */
    private validateArgumentTypes(spread: FragmentSpreadData, fragment: FragmentData): void {
        if (fragment.argumentDefinition === null || spread.arguments === null) return;

        for (const arg of spread.arguments) {
            const argDef = fragment.argumentDefinition.find((d) => d.name === arg.name);
            if (!argDef) continue; // 名前不一致は validateArgumentNames で検出済み

            const variableType = this.resolveVariableType(arg.value, spread.scope);
            if (!variableType) continue; // 型が解決できない場合はスキップ

            let targetType: TypeNode;
            try {
                targetType = parseType(argDef.type);
            } catch {
                continue; // 型文字列の不正は Rule 1 で検出済み
            }

            if (!isTypeCompatible(variableType, targetType)) {
                this.addIssue({
                    level: "error",
                    message: `Argument "${arg.name}": variable "$${arg.value}" of type "${typeNodeToString(variableType)}" is not compatible with "${argDef.type}"`,
                    fragmentName: spread.name,
                    location: this.locationOf(spread.node),
                });
            }
        }
    }

    /**
     * スコープから変数の型を解決する
     * - operation スコープ: Query/Mutation/Subscription の variableDefinitions から探す
     * - fragment スコープ: 親 Fragment の @argumentDefinitions から探す
     */
    private resolveVariableType(variableName: string, scope: SpreadScope): TypeNode | null {
        if (scope.kind === 'operation') {
            const varDef = scope.variableDefinitions.find(
                (v) => v.variable.name.value === variableName
            );
            return varDef?.type ?? null;
        }

        const containingFragment = this.fragments.get(scope.fragmentName);
        if (!containingFragment?.argumentDefinition) return null;

        const argDef = containingFragment.argumentDefinition.find((a) => a.name === variableName);
        if (!argDef) return null;

        try {
            return parseType(argDef.type);
        } catch {
            return null;
        }
    }

    public getIssues(): ValidationIssue[] {
        return this.issues;
    }

    public getStats() {
        return {
            issuedFragmentsCount: this.issuedFragments.size,
            issuesCount: this.issues.length,
        };
    }
}
