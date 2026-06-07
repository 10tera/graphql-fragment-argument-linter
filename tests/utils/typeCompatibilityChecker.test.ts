import { describe, it, expect } from 'vitest';
import { parseType } from 'graphql';
import { isTypeCompatible, typeNodeToString } from '../../src/utils/typeCompatibilityChecker';

const t = (typeStr: string) => parseType(typeStr);

describe('isTypeCompatible', () => {
  describe('NamedType 同士', () => {
    it('T! → T!: OK', () => {
      expect(isTypeCompatible(t('ID!'), t('ID!'))).toBe(true);
    });

    it('T! → T: OK（non-nullable を nullable に渡せる）', () => {
      expect(isTypeCompatible(t('ID!'), t('ID'))).toBe(true);
    });

    it('T → T!: NG（nullable を non-nullable に渡せない）', () => {
      expect(isTypeCompatible(t('ID'), t('ID!'))).toBe(false);
    });

    it('T → T: OK', () => {
      expect(isTypeCompatible(t('ID'), t('ID'))).toBe(true);
    });

    it('型名が異なる場合: NG', () => {
      expect(isTypeCompatible(t('String'), t('ID'))).toBe(false);
    });

    it('型名が異なる non-nullable 同士: NG', () => {
      expect(isTypeCompatible(t('String!'), t('ID!'))).toBe(false);
    });

    it('non-nullable を異なる nullable 型に渡す: NG', () => {
      expect(isTypeCompatible(t('String!'), t('ID'))).toBe(false);
    });
  });

  describe('ListType', () => {
    it('[T!]! → [T!]!: OK', () => {
      expect(isTypeCompatible(t('[ID!]!'), t('[ID!]!'))).toBe(true);
    });

    it('[T!]! → [T!]: OK（外側の non-nullable を nullable に渡せる）', () => {
      expect(isTypeCompatible(t('[ID!]!'), t('[ID!]'))).toBe(true);
    });

    it('[T!] → [T!]!: NG', () => {
      expect(isTypeCompatible(t('[ID!]'), t('[ID!]!'))).toBe(false);
    });

    it('[T!] → [T]: OK（内側の non-nullable を nullable に渡せる）', () => {
      expect(isTypeCompatible(t('[ID!]'), t('[ID]'))).toBe(true);
    });

    it('[T] → [T!]: NG（内側で nullable を non-nullable に渡せない）', () => {
      expect(isTypeCompatible(t('[ID]'), t('[ID!]'))).toBe(false);
    });

    it('[T!]! → [T]!: OK（内側の non-nullable を nullable に渡せる）', () => {
      expect(isTypeCompatible(t('[ID!]!'), t('[ID]!'))).toBe(true);
    });
  });

  describe('異なる種類の型', () => {
    it('NamedType → ListType: NG', () => {
      expect(isTypeCompatible(t('ID'), t('[ID]'))).toBe(false);
    });

    it('ListType → NamedType: NG', () => {
      expect(isTypeCompatible(t('[ID]'), t('ID'))).toBe(false);
    });

    it('NamedType! → ListType: NG', () => {
      expect(isTypeCompatible(t('ID!'), t('[ID]'))).toBe(false);
    });
  });

  describe('実際のユースケース', () => {
    it('String! → String: OK', () => {
      expect(isTypeCompatible(t('String!'), t('String'))).toBe(true);
    });

    it('Int → Int!: NG', () => {
      expect(isTypeCompatible(t('Int'), t('Int!'))).toBe(false);
    });

    it('Boolean! → Boolean!: OK', () => {
      expect(isTypeCompatible(t('Boolean!'), t('Boolean!'))).toBe(true);
    });

    it('[String!]! → [String!]!: OK', () => {
      expect(isTypeCompatible(t('[String!]!'), t('[String!]!'))).toBe(true);
    });
  });
});

describe('typeNodeToString', () => {
  it('nullable NamedType', () => {
    expect(typeNodeToString(t('ID'))).toBe('ID');
  });

  it('non-nullable NamedType', () => {
    expect(typeNodeToString(t('ID!'))).toBe('ID!');
  });

  it('nullable ListType', () => {
    expect(typeNodeToString(t('[String]'))).toBe('[String]');
  });

  it('non-nullable ListType', () => {
    expect(typeNodeToString(t('[String!]!'))).toBe('[String!]!');
  });

  it('ネストしたリスト', () => {
    expect(typeNodeToString(t('[[Int!]!]!'))).toBe('[[Int!]!]!');
  });
});
