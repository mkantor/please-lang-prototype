import { either, type Either, type Option, option } from '../adts.js'
import type { Panic, UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { withPhantomData, type WithPhantomData } from '../phantom-data.js'
import type { Writable } from '../utility-types.js'

const nodeTag = Symbol('nodeTag')

export type AtomNode = {
  readonly [nodeTag]: 'atom'
  readonly atom: Atom
}
export const isAtomNode = (node: SemanticGraph) => node[nodeTag] === 'atom'
export const makeAtomNode = (atom: Atom): AtomNode => ({
  [nodeTag]: 'atom',
  atom,
})
const serializeAtomNode = (
  node: AtomNode,
): Either<never, WithPhantomData<Atom, Serialized>> =>
  either.makeRight(withPhantomData<Serialized>()(node.atom))

export type FunctionNode = {
  readonly [nodeTag]: 'function'
  readonly function: (value: SemanticGraph) => Either<Panic, SemanticGraph>
  // TODO: model the function's type signature as data in here?
}
export const isFunctionNode = (node: SemanticGraph) =>
  node[nodeTag] === 'function'
export const makeFunctionNode = (
  f: (value: SemanticGraph) => Either<Panic, SemanticGraph>,
): FunctionNode => ({ [nodeTag]: 'function', function: f })
const serializeFunctionNode = (
  _node: FunctionNode,
): Either<UnserializableValueError, Output> =>
  either.makeLeft({
    kind: 'unserializableValue',
    message: 'functions cannot be serialized',
  })

export type ObjectNode = {
  readonly [nodeTag]: 'object'
  readonly children: Readonly<Record<Atom, SemanticGraph>>
}
export const isObjectNode = (node: SemanticGraph) => node[nodeTag] === 'object'
export const makeObjectNode = (
  children: Readonly<Record<Atom, SemanticGraph>>,
): ObjectNode => ({ [nodeTag]: 'object', children })
const serializeObjectNode = (
  node: ObjectNode,
): Either<UnserializableValueError, Output> => {
  const molecule: Writable<Molecule> = {}
  for (const [key, propertyValue] of Object.entries(node.children)) {
    const serializedPropertyValueResult = serialize(propertyValue)
    if (either.isLeft(serializedPropertyValueResult)) {
      return serializedPropertyValueResult
    } else {
      molecule[key] = serializedPropertyValueResult.value
    }
  }
  return either.makeRight(withPhantomData<Serialized>()(molecule))
}

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
): Either<UnserializableValueError, Output> =>
  isAtomNode(node)
    ? serializeAtomNode(node)
    : isFunctionNode(node)
    ? serializeFunctionNode(node)
    : serializeObjectNode(node)
