import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
import * as orderedRecord from '../../ordered-record.js'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { asSemanticGraph } from './expressions/expression-utilities.js'
import { serializeFunctionNode } from './function-node.js'
import { nodeTag } from './semantic-graph-node-tag.js'
import { serialize, type Output, type SemanticGraph } from './semantic-graph.js'

export type ObjectNode = {
  readonly [nodeTag]: 'object'
  readonly [key: Atom]: SemanticGraph
}

export const isObjectNode = (node: SemanticGraph) =>
  typeof node === 'object' && node[nodeTag] === 'object'

export const lookupPropertyOfObjectNode = (
  key: Atom,
  node: ObjectNode,
): Option<SemanticGraph> =>
  key in node && node[key] !== undefined ?
    option.makeSome(
      typeof node[key] === 'object' ? makeObjectNode(node[key]) : node[key],
    )
  : option.none

type PropertyValueToSemanticGraph<
  PropertyValue extends SemanticGraph | Molecule,
> =
  PropertyValue extends SemanticGraph ? PropertyValue
  : PropertyValue extends Molecule ? ObjectNode
  : never

type PropertiesToSemanticGraphs<
  Properties extends Readonly<Record<Atom, SemanticGraph | Molecule>>,
> = {
  [K in keyof Properties]: PropertyValueToSemanticGraph<Properties[K]>
}

export const makeObjectNode = <
  const Properties extends Readonly<Record<Atom, SemanticGraph | Molecule>>,
>(
  properties: Properties,
): ObjectNode & PropertiesToSemanticGraphs<Properties> => {
  const propertiesAsSemanticGraphs = Object.fromEntries(
    Object.entries(properties).map(
      ([key, value]) => [key, asSemanticGraph(value)] as const,
    ),
  ) satisfies Record<
    Atom,
    SemanticGraph
  > as PropertiesToSemanticGraphs<Properties> // This type assertion assumes no excess properties are present.

  return {
    ...propertiesAsSemanticGraphs,
    [nodeTag]: 'object',
  }
}

/**
 * Convert an OrderedRecord-backed `Molecule` to an `ObjectNode`. Property
 * values that are themselves `Molecule`s are converted recursively.
 */
export const objectNodeFromMolecule = (molecule: Molecule): ObjectNode => {
  const propertiesAsSemanticGraphs = Object.fromEntries(
    molecule.entries.map(
      ([key, value]) => [key, asSemanticGraph(value)] as const,
    ),
  )
  return {
    ...propertiesAsSemanticGraphs,
    [nodeTag]: 'object',
  }
}

export const serializeObjectNode = (
  node: ObjectNode,
): Either<UnserializableValueError, Molecule> => {
  const serializedEntries: (readonly [Atom, Output])[] = []
  for (const [key, propertyValue] of Object.entries(node)) {
    const serializedPropertyValueResult =
      serializeObjectPropertyValue(propertyValue)
    if (either.isLeft(serializedPropertyValueResult)) {
      return serializedPropertyValueResult
    } else {
      serializedEntries.push([key, serializedPropertyValueResult.value])
    }
  }
  return either.makeRight(orderedRecord.make(serializedEntries))
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
