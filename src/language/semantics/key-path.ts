import type { Atom, Molecule } from '../parsing.js'

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
  JSON.stringify(keyPath)

export const keyPathToMolecule = (keyPath: KeyPath): Molecule =>
  Object.fromEntries(
    keyPath.flatMap((key, index) =>
      typeof key === 'symbol' ? [] : [[index, key]],
    ),
  )
