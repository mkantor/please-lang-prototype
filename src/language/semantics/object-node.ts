import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
import type { Writable } from '../../utility-types.js'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { serializeFunctionNode } from './function-node.js'
import { nodeTag } from './semantic-graph-node-tag.js'
import { serialize, type Output, type SemanticGraph } from './semantic-graph.js'

export type ObjectNode = {
  readonly [nodeTag]: 'object'
  readonly [key: Atom]: SemanticGraph | Molecule
}

export const isObjectNode = (node: SemanticGraph) =>
  typeof node === 'object' && node[nodeTag] === 'object'

export const lookupPropertyOfObjectNode = (
  key: Atom,
  node: ObjectNode,
): Option<SemanticGraph> =>
  key in node && node[key] !== undefined
    ? option.makeSome(
        typeof node[key] === 'object' ? makeObjectNode(node[key]) : node[key],
      )
    : option.none

export const makeObjectNode = <
  const Properties extends Readonly<Record<Atom, SemanticGraph | Molecule>>,
>(
  properties: Properties,
): ObjectNode & Properties => ({
  ...properties,
  [nodeTag]: 'object',
})

export const serializeObjectNode = (
  node: ObjectNode,
): Either<UnserializableValueError, Molecule> => {
  const molecule: Writable<Molecule> = {}
  for (const [key, propertyValue] of Object.entries(node)) {
    const serializedPropertyValueResult =
      serializeObjectPropertyValue(propertyValue)
    if (either.isLeft(serializedPropertyValueResult)) {
      return serializedPropertyValueResult
    } else {
      molecule[key] = serializedPropertyValueResult.value
    }
  }
  return either.makeRight(molecule)
}

const serializeObjectPropertyValue = (
  propertyValue: ObjectNode[string],
): Either<UnserializableValueError, Output> => {
  switch (typeof propertyValue) {
    case 'string':
    case 'symbol':
      return serialize(propertyValue)
    case 'object':
      return serialize(makeObjectNode(propertyValue))
    case 'function':
      return serializeFunctionNode(propertyValue)
  }
}
