import either from '@matt.kantor/either'
import type { Atom, Molecule } from '../parsing.js'
import { inlinePlz, unparse } from '../unparsing.js'

export type KeyPath = readonly Atom[]

export const stringifyKeyPathForEndUser = (keyPath: KeyPath): string =>
  either.match(unparse(keyPathToMolecule(keyPath), inlinePlz), {
    right: stringifiedOutput => stringifiedOutput,
    left: error => `(unserializable key path: ${error.message})`,
  })

export const keyPathToMolecule = (keyPath: KeyPath): Molecule =>
  Object.fromEntries(keyPath.flatMap((key, index) => [[index, key]]))
