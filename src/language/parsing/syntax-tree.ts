import { option, type Option } from '../../adts.js'
import { parser, type Parser } from '../../parsing.js'
import { withPhantomData, type WithPhantomData } from '../../phantom-data.js'
import type {
  JSONArray,
  JSONRecord,
  JSONValue,
  Writable,
} from '../../utility-types.js'
import type { KeyPath } from '../semantics.js'
import { atomParser, type Atom } from './atom.js'
import { moleculeParser, type Molecule } from './molecule.js'

declare const _canonicalized: unique symbol
type Canonicalized = { readonly [_canonicalized]: true }
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
    } else if (typeof firstKey === 'symbol') {
      // TODO: Treat this as an error? Or change the type of `keyPath`?
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
  input: JSONValueForbiddingSymbolicKeys,
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
export type JSONValueForbiddingSymbolicKeys =
  | Exclude<JSONValue, JSONArray | JSONRecord>
  | JSONArrayForbiddingSymbolicKeys
  | JSONRecordForbiddingSymbolicKeys

type JSONArrayForbiddingSymbolicKeys =
  readonly JSONValueForbiddingSymbolicKeys[]
type JSONRecordForbiddingSymbolicKeys = {
  readonly [key: string]: JSONValueForbiddingSymbolicKeys
} & Partial<{
  readonly [key: symbol]: undefined
}>

export const syntaxTreeParser: Parser<SyntaxTree> = parser.map(
  parser.oneOf([atomParser, moleculeParser]),
  canonicalize,
)
