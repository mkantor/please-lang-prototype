import { withPhantomData, type WithPhantomData } from '../../phantom-data.js'
import type {
  JSONArray,
  JSONRecord,
  JSONValue,
  Writable,
} from '../../utility-types.js'
import type { Atom } from './atom.js'
import type { Molecule } from './molecule.js'

declare const _canonicalized: unique symbol
type Canonicalized = { readonly [_canonicalized]: true }
export type SyntaxTree = WithPhantomData<Atom | Molecule, Canonicalized>

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
