import { TypeNode } from 'graphql';

export const typeNodeToString = (type: TypeNode): string => {
    if (type.kind === 'NonNullType') return `${typeNodeToString(type.type)}!`;
    if (type.kind === 'ListType') return `[${typeNodeToString(type.type)}]`;
    return type.name.value;
};

/**
 * sourceType が targetType に渡せるか（型互換性）をチェックする
 *
 * - T! → T!: OK
 * - T! → T:  OK（non-nullable を nullable に渡せる）
 * - T  → T!: NG（nullable を non-nullable に渡せない）
 * - T  → T:  OK
 */
export const isTypeCompatible = (sourceType: TypeNode, targetType: TypeNode): boolean => {
    const srcIsNonNull = sourceType.kind === 'NonNullType';
    const tgtIsNonNull = targetType.kind === 'NonNullType';

    if (tgtIsNonNull && !srcIsNonNull) return false;

    const srcInner = srcIsNonNull ? sourceType.type : sourceType;
    const tgtInner = tgtIsNonNull ? targetType.type : targetType;

    if (srcInner.kind !== tgtInner.kind) return false;

    if (srcInner.kind === 'NamedType' && tgtInner.kind === 'NamedType') {
        return srcInner.name.value === tgtInner.name.value;
    }

    if (srcInner.kind === 'ListType' && tgtInner.kind === 'ListType') {
        return isTypeCompatible(srcInner.type, tgtInner.type);
    }

    return false;
};
