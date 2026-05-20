import option, { type Option } from '@matt.kantor/option'
import { map, sequence, type Parser } from '@matt.kantor/parsing'
import * as orderedRecord from '../../ordered-record.js'
import type { JsonArray, JsonRecord, JsonValue } from '../../utility-types.js'
import type { KeyPath } from '../semantics.js'
import { type Atom } from './atom.js'
import { expression, type Molecule } from './expression.js'
import { optionalTrivia } from './trivia.js'

export type SyntaxTree = Atom | Molecule

export const applyKeyPathToSyntaxTree = (
  syntaxTree: SyntaxTree,
  keyPath: KeyPath,
): Option<SyntaxTree> => {
  const [firstKey, ...remainingKeyPath] = keyPath
  if (firstKey === undefined) {
    return option.makeSome(syntaxTree)
  } else if (typeof syntaxTree === 'string') {
    return option.none
  } else {
    return option.flatMap(orderedRecord.get(syntaxTree, firstKey), next =>
      applyKeyPathToSyntaxTree(next, remainingKeyPath),
    )
  }
}

/**
 * Canonicalized syntax trees are made of strings and (potentially-nested)
 * `OrderedRecord`s with string-valued properties.
 */
export const canonicalize = (
  input: JsonValueForbiddingSymbolicKeys,
): SyntaxTree =>
  typeof input === 'string' ? input
  : input === null || typeof input !== 'object' ? String(input)
  : orderedRecord.make(
      Object.entries(input).map(([key, value]) => [key, canonicalize(value)]),
    )

/**
 * `canonicalize` inputs should not have symbolic keys. This type doesn't
 * robustly guarantee that (because symbolic keys can always be widened away),
 * but will catch simple mistakes like directly feeding an `Option<…>` into
 * `canonicalize`.
 */
export type JsonValueForbiddingSymbolicKeys =
  | Exclude<JsonValue, JsonArray | JsonRecord>
  | JsonArrayForbiddingSymbolicKeys
  | JsonRecordForbiddingSymbolicKeys

type JsonArrayForbiddingSymbolicKeys =
  readonly JsonValueForbiddingSymbolicKeys[]
type JsonRecordForbiddingSymbolicKeys = {
  readonly [key: string]: JsonValueForbiddingSymbolicKeys
} & Partial<{
  readonly [key: symbol]: undefined
}>

export const syntaxTreeParser: Parser<SyntaxTree> = map(
  sequence([optionalTrivia, expression, optionalTrivia]),
  ([_leadingTrivia, syntaxTree, _trailingTrivia]) => syntaxTree,
)
