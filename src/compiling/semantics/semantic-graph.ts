import type { Either } from '../../adts/either.js'
import type { Option } from '../../adts/option.js'
import * as option from '../../adts/option.js'
import type { Writable } from '../../utility-types.js'
import type { Panic } from '../errors.js'
import type { Atom } from '../parsing/atom.js'
import type { Molecule } from '../parsing/molecule.js'

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

export type ObjectNode = {
  readonly [nodeTag]: 'object'
  readonly children: Readonly<Record<Atom, SemanticGraph>>
}
export const isObjectNode = (node: SemanticGraph) => node[nodeTag] === 'object'
export const makeObjectNode = (
  children: Readonly<Record<Atom, SemanticGraph>>,
): ObjectNode => ({ [nodeTag]: 'object', children })

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
