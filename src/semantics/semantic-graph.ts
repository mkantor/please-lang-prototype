import { either, option, type Either, type Option } from '../adts.js'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { withPhantomData, type WithPhantomData } from '../phantom-data.js'
import type { Writable } from '../utility-types.js'
import {
  isAtomNode,
  makeAtomNode,
  serializeAtomNode,
  type AtomNode,
} from './atom-node.js'
import {
  isFunctionNode,
  serializeFunctionNode,
  type FunctionNode,
} from './function-node.js'
import {
  isObjectNode,
  serializeObjectNode,
  type ObjectNode,
} from './object-node.js'

export const nodeTag = Symbol('nodeTag')

export type SemanticGraph = AtomNode | FunctionNode | ObjectNode

export type KeyPath = readonly string[]

export const applyKeyPath = (
  graph: SemanticGraph,
  keyPath: readonly string[],
): Option<SemanticGraph> => {
  const [firstKey, ...remainingKeyPath] = keyPath
  if (firstKey === undefined) {
    return option.makeSome(graph)
  } else if (!isObjectNode(graph)) {
    return option.none
  } else {
    const next = graph.children[firstKey]
    if (next === undefined) {
      return option.none
    } else {
      return applyKeyPath(next, remainingKeyPath)
    }
  }
}

export const literalValueToSemanticGraph = (
  value: Atom | Molecule,
): SemanticGraph =>
  typeof value === 'string'
    ? makeAtomNode(value)
    : literalMoleculeToObjectNode(value)

export const literalMoleculeToObjectNode = (molecule: Molecule): ObjectNode => {
  const children: Writable<ObjectNode['children']> = {}
  for (const [key, propertyValue] of Object.entries(molecule)) {
    children[key] = literalValueToSemanticGraph(propertyValue)
  }
  return { [nodeTag]: 'object', children }
}

declare const _serialized: unique symbol
type Serialized = { readonly [_serialized]: true }
export type Output = WithPhantomData<Atom | Molecule, Serialized>

export const serialize = (
  node: SemanticGraph,
): Either<UnserializableValueError, Output> => {
  const result: Either<UnserializableValueError, Atom | Molecule> = isAtomNode(
    node,
  )
    ? serializeAtomNode(node)
    : isFunctionNode(node)
    ? serializeFunctionNode(node)
    : serializeObjectNode(node)

  return either.map(result, withPhantomData<Serialized>())
}
