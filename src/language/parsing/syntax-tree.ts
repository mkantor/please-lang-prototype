import option, { type Option } from '@matt.kantor/option'
import { map, nothing, oneOf, sequence, type Parser } from '@matt.kantor/parsing'
import { withPhantomData, type WithPhantomData } from '../../phantom-data.js'
import type {
  JsonArray,
  JsonRecord,
  JsonValue,
  Writable,
} from '../../utility-types.js'
import type { KeyPath } from '../semantics.js'
import { atomParser, type Atom } from './atom.js'
import { moleculeParser, type Molecule } from './molecule.js'
import { trivia } from './trivia.js'

declare const _canonicalized: unique symbol
export type Canonicalized = { readonly [_canonicalized]: true }
export type SyntaxTree = WithPhantomData<Atom | Molecule, Canonicalized>

export const applyKeyPathToSyntaxTree = (
  syntaxTree: SyntaxTree,
  keyPath: KeyPath,
): Option<SyntaxTree> => {
  const [firstKey, ...remainingKeyPath] = keyPath
  if (firstKey === undefined) {
    return option.makeSome(syntaxTree)
  } else {
    if (typeof syntaxTree === 'string') {
      return option.none
    } else {
      const next = withPhantomData<Canonicalized>()(syntaxTree[firstKey])
      if (next === undefined) {
        return option.none
      } else {
        return applyKeyPathToSyntaxTree(next, remainingKeyPath)
      }
    }
  }
}

/**
 * Canonicalized syntax trees are made of strings and (potentially-nested) objects with
 * string-valued properties.
 *
 * The JSON value `["a", 1, null]` is canonicalized as `{ "0": "a", "1": "1", "2": "null" }`.
 */
export const canonicalize = (
  input: JsonValueForbiddingSymbolicKeys,
): SyntaxTree => {
  let canonicalized: Atom | Writable<Molecule>
  if (typeof input === 'object' && input !== null) {
    canonicalized = {}
    for (let [key, value] of Object.entries(input)) {
      canonicalized[key] = canonicalize(value)
    }
  } else {
    canonicalized = typeof input === 'string' ? input : String(input)
  }
  return withPhantomData<Canonicalized>()(canonicalized)
}

/**
 * `canonicalize` inputs should not have symbolic keys. This type doesn't robustly guarantee that
 * (because symbolic keys can always be widened away), but will catch simple mistakes like directly
 * feeding an `Option<…>` into `canonicalize`.
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

const optionalTrivia = oneOf([trivia, nothing])

export const syntaxTreeParser: Parser<SyntaxTree> = map(
  sequence([optionalTrivia, oneOf([moleculeParser, atomParser]), optionalTrivia]),
  ([_leadingTrivia, syntaxTree, _trailingTrivia]) => canonicalize(syntaxTree),
)
