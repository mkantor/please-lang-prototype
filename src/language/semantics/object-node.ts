import { either, type Either } from '../../adts.js'
import type { Writable } from '../../utility-types.js'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import {
  nodeTag,
  serialize,
  type FullyElaboratedSemanticGraph,
} from './semantic-graph.js'

export type ObjectNode = {
  readonly [nodeTag]: 'object'
  readonly [key: Atom]: FullyElaboratedSemanticGraph
}

export const isObjectNode = (node: FullyElaboratedSemanticGraph) =>
  typeof node === 'object' && node[nodeTag] === 'object'

export const makeObjectNode = (
  properties: Readonly<Record<Atom, FullyElaboratedSemanticGraph>>,
): ObjectNode => ({
  [nodeTag]: 'object',
  ...properties,
})

export const serializeObjectNode = (
  node: ObjectNode,
): Either<UnserializableValueError, Molecule> => {
  const molecule: Writable<Molecule> = {}
  for (const [key, propertyValue] of Object.entries(node)) {
    const serializedPropertyValueResult = serialize(propertyValue)
    if (either.isLeft(serializedPropertyValueResult)) {
      return serializedPropertyValueResult
    } else {
      molecule[key] = serializedPropertyValueResult.value
    }
  }
  return either.makeRight(molecule)
}
