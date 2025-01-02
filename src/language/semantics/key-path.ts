import { either } from '../../adts.js'
import type { Atom, Molecule } from '../parsing.js'
import { unparse } from '../unparsing.js'
import { prettyPlz } from '../unparsing/pretty-plz.js'

export const functionParameter = Symbol('functionParameter')
export const functionReturn = Symbol('functionReturn')
export const typeParameterAssignableToConstraint = Symbol(
  'typeParameterAssignableToConstraint',
)
export type KeyPath = readonly (
  | Atom
  // These symbol keys are somewhat "internal" at the moment. If they end up not being expressible
  // in the surface syntax then `KeyPath` should be split into two separate types.
  | typeof functionParameter
  | typeof functionReturn
  | typeof typeParameterAssignableToConstraint
)[]

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
  Object.fromEntries(
    keyPath.flatMap((key, index) =>
      typeof key === 'symbol' ? [] : [[index, key]],
    ),
  )
