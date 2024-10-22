import { withPhantomData, type WithPhantomData } from '../phantom-data.js'
import type { JSONValue, Writable } from '../utility-types.js'
import type { Atom } from './atom.js'
import type { Canonicalized } from './stages.js'

export type Molecule = { readonly [key: Atom]: Molecule | Atom }

/**
 * Canonicalized molecules are made of (potentially-nested) objects with `string` keys and values.
 *
 * The `InputMolecule` `["a", 1, null]` is canonicalized as `{ "0": "a", "1": "1", "2": "null" }`.
 */
export type CanonicalizedMolecule = WithPhantomData<Molecule, Canonicalized>
export type CanonicalizedAtom = WithPhantomData<Atom, Canonicalized>

export const canonicalize = (
  input: JSONValue,
): CanonicalizedAtom | CanonicalizedMolecule => {
  let canonicalized: CanonicalizedAtom | Writable<CanonicalizedMolecule>
  if (typeof input === 'object' && input !== null) {
    canonicalized = withPhantomData<Canonicalized>()({})
    for (let [key, value] of Object.entries(input)) {
      canonicalized[key] = canonicalize(value)
    }
  } else {
    canonicalized = withPhantomData<Canonicalized>()(
      typeof input === 'string' ? input : String(input),
    )
  }
  return canonicalized
}

export const unit: CanonicalizedMolecule = withPhantomData<Canonicalized>()({})
