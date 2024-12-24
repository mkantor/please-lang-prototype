import { either } from '../../adts.js'
import type { Atom, Molecule } from '../parsing.js'
import { unparse } from '../unparsing.js'
import { prettyPlz } from '../unparsing/pretty-plz.js'

export type KeyPath = readonly Atom[]

export const stringifyKeyPathForEndUser = (keyPath: KeyPath): string =>
  either.match(
    // TODO: Use single-line plz notation.
    unparse(keyPathToMolecule(keyPath), prettyPlz),
    {
      right: stringifiedOutput => stringifiedOutput,
      left: error => `(unserializable key path: ${error.message})`,
    },
  )

export const keyPathToMolecule = (keyPath: KeyPath): Molecule =>
  Object.fromEntries(keyPath.flatMap((key, index) => [[index, key]]))
