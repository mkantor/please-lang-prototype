import either, { type Either } from '@matt.kantor/either'
import type { InvalidExpressionError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { inlinePlz, unparse } from '../unparsing.js'
import type { ObjectNode } from './object-node.js'

export type KeyPath = readonly Atom[]

export const stringifyKeyPathForEndUser = (keyPath: KeyPath): string =>
  either.match(unparse(keyPathToMolecule(keyPath), inlinePlz), {
    right: stringifiedOutput => stringifiedOutput,
    left: error => `(unserializable key path: ${error.message})`,
  })

export const keyPathToMolecule = (keyPath: KeyPath): Molecule =>
  Object.fromEntries(keyPath.flatMap((key, index) => [[index, key]]))

export const keyPathFromObjectNodeOrMolecule = (
  node: ObjectNode | Molecule,
): Either<InvalidExpressionError, KeyPath> => {
  const relativePath: string[] = []
  let queryIndex = 0
  // Consume numeric indexes ("0", "1", …) until exhausted, validating that each is an atom.
  let key = node[queryIndex]
  while (key !== undefined) {
    if (typeof key !== 'string') {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'expected a key path composed of sequential atoms',
      })
    } else {
      relativePath.push(key)
    }
    queryIndex++
    key = node[queryIndex]
  }
  return either.makeRight(relativePath)
}
