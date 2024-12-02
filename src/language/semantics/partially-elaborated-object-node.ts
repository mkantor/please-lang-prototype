import { either, type Either } from '../../adts.js'
import type { Writable } from '../../utility-types.js'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import {
  isPartiallyElaboratedSemanticGraph,
  nodeTag,
  serialize,
  type PartiallyElaboratedSemanticGraph,
} from './semantic-graph.js'

export type PartiallyElaboratedObjectNode = {
  readonly [nodeTag]: 'object'
  readonly [key: Atom]: PartiallyElaboratedSemanticGraph
}

export const isPartiallyElaboratedObjectNode = (
  node: PartiallyElaboratedSemanticGraph,
) => typeof node === 'object' && node[nodeTag] === 'object'

export const makePartiallyElaboratedObjectNode = (
  properties: Readonly<
    Record<Atom, PartiallyElaboratedSemanticGraph | Atom | Molecule>
  >,
): PartiallyElaboratedObjectNode => ({
  [nodeTag]: 'object',
  ...properties,
})

export const serializePartiallyElaboratedObjectNode = (
  node: PartiallyElaboratedObjectNode,
): Either<UnserializableValueError, Molecule> => {
  const molecule: Writable<Molecule> = {}
  for (const [key, propertyValue] of Object.entries(node)) {
    const serializedPropertyValueResult = isPartiallyElaboratedSemanticGraph(
      propertyValue,
    )
      ? serialize(propertyValue)
      : either.makeRight(propertyValue)
    if (either.isLeft(serializedPropertyValueResult)) {
      return serializedPropertyValueResult
    } else {
      molecule[key] = serializedPropertyValueResult.value
    }
  }
  return either.makeRight(molecule)
}
