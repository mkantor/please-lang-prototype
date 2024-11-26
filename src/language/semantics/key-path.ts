import type { Atom } from '../parsing.js'

export const functionParameter = Symbol('functionParameter')
export const functionReturn = Symbol('functionReturn')
export const typeParameterAssignableToConstraint = Symbol(
  'typeParameterAssignableToConstraint',
)
export type KeyPath = readonly (
  | Atom
  | typeof functionParameter
  | typeof functionReturn
  | typeof typeParameterAssignableToConstraint
)[]

export const stringifyKeyPathForEndUser = (keyPath: KeyPath): string =>
  JSON.stringify(keyPath)
