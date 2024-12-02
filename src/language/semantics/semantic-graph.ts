import { either, option, type Either, type Option } from '../../adts.js'
import { withPhantomData, type WithPhantomData } from '../../phantom-data.js'
import type {
  InvalidExpressionError,
  UnserializableValueError,
} from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { serializeFunctionNode, type FunctionNode } from './function-node.js'
import { stringifyKeyPathForEndUser, type KeyPath } from './key-path.js'
import { type ObjectNode } from './object-node.js'
import {
  makePartiallyElaboratedObjectNode,
  serializePartiallyElaboratedObjectNode,
  type PartiallyElaboratedObjectNode,
} from './partially-elaborated-object-node.js'

export const nodeTag = Symbol('nodeTag')

export type PartiallyElaboratedSemanticGraph =
  | Atom
  | FunctionNode
  | PartiallyElaboratedObjectNode

export type FullyElaboratedSemanticGraph = Atom | FunctionNode | ObjectNode

export const applyKeyPathToPartiallyElaboratedSemanticGraph = (
  node: PartiallyElaboratedSemanticGraph,
  keyPath: KeyPath,
): Option<PartiallyElaboratedSemanticGraph> => {
  const [firstKey, ...remainingKeyPath] = keyPath
  if (firstKey === undefined) {
    return option.makeSome(node)
  } else {
    return matchPartiallyElaboratedSemanticGraph(node, {
      atom: _ => option.none,
      function: _ => option.none,
      object: graph => {
        if (typeof firstKey === 'symbol') {
          return option.none
        } else {
          const next = graph.children[firstKey]
          if (next === undefined) {
            return option.none
          } else {
            return applyKeyPathToPartiallyElaboratedSemanticGraph(
              isPartiallyElaboratedSemanticGraph(next)
                ? next
                : syntaxTreeToPartiallyElaboratedSemanticGraph(next),
              remainingKeyPath,
            )
          }
        }
      },
    })
  }
}

export const extractStringValueIfPossible = (
  node: Atom | Molecule | PartiallyElaboratedSemanticGraph,
) => {
  if (typeof node === 'string') {
    return option.makeSome(node)
  } else {
    return option.none
  }
}

const makePropertyNotFoundError = (
  keyPath: KeyPath,
): InvalidExpressionError => ({
  kind: 'invalidExpression',
  message: `property \`${stringifyKeyPathForEndUser(keyPath)}\` not found`,
})

export const updateValueAtKeyPathInPartiallyElaboratedSemanticGraph = (
  node: PartiallyElaboratedSemanticGraph,
  keyPath: KeyPath,
  operation: (
    valueAtKeyPath: PartiallyElaboratedSemanticGraph,
  ) => PartiallyElaboratedSemanticGraph, // TODO should this be fallible? see above
): Either<InvalidExpressionError, PartiallyElaboratedSemanticGraph> => {
  const [firstKey, ...remainingKeyPath] = keyPath
  if (firstKey === undefined) {
    // If the key path is empty, this is the value to operate on.
    return either.makeRight(operation(node))
  } else {
    return matchPartiallyElaboratedSemanticGraph(node, {
      atom: _ => either.makeLeft(makePropertyNotFoundError(keyPath)),
      function: _ => either.makeLeft(makePropertyNotFoundError(keyPath)),
      object: node => {
        if (typeof firstKey === 'symbol') {
          return either.makeLeft(makePropertyNotFoundError(keyPath))
        } else {
          const next = node.children[firstKey]
          if (next === undefined) {
            return either.makeLeft(makePropertyNotFoundError(keyPath))
          } else {
            return either.map(
              updateValueAtKeyPathInPartiallyElaboratedSemanticGraph(
                isPartiallyElaboratedSemanticGraph(next)
                  ? next
                  : syntaxTreeToPartiallyElaboratedSemanticGraph(next),
                remainingKeyPath,
                operation,
              ),
              updatedNode =>
                makePartiallyElaboratedObjectNode({
                  ...node.children,
                  [firstKey]: updatedNode,
                }),
            )
          }
        }
      },
    })
  }
}

export const matchPartiallyElaboratedSemanticGraph = <Result>(
  semanticGraph: PartiallyElaboratedSemanticGraph,
  cases: {
    atom: (node: Atom) => Result
    function: (node: FunctionNode) => Result
    object: (node: PartiallyElaboratedObjectNode) => Result
  },
): Result => {
  if (typeof semanticGraph === 'string') {
    return cases.atom(semanticGraph)
  } else {
    switch (semanticGraph[nodeTag]) {
      case 'function':
        return cases[semanticGraph[nodeTag]](semanticGraph)
      case 'object':
        return cases[semanticGraph[nodeTag]](semanticGraph)
    }
  }
}

declare const _serialized: unique symbol
type Serialized = { readonly [_serialized]: true }
export type Output = WithPhantomData<Atom | Molecule, Serialized>

export const serialize = (
  node: PartiallyElaboratedSemanticGraph,
): Either<UnserializableValueError, Output> =>
  either.map(
    matchPartiallyElaboratedSemanticGraph(node, {
      atom: (node): Either<UnserializableValueError, Atom | Molecule> =>
        either.makeRight(node),
      function: node => serializeFunctionNode(node),
      object: node => serializePartiallyElaboratedObjectNode(node),
    }),
    withPhantomData<Serialized>(),
  )

export const isPartiallyElaboratedSemanticGraph = (
  value:
    | Atom
    | Molecule
    | {
        readonly [nodeTag]?: Exclude<
          PartiallyElaboratedSemanticGraph,
          Atom
        >[typeof nodeTag]
      },
): value is PartiallyElaboratedSemanticGraph =>
  typeof value === 'string' ||
  ((typeof value === 'object' || typeof value === 'function') &&
    nodeTag in value &&
    typeof value[nodeTag] === 'string')

const syntaxTreeToPartiallyElaboratedSemanticGraph = (
  syntaxTree: Atom | Molecule,
): PartiallyElaboratedObjectNode | Atom =>
  typeof syntaxTree === 'string'
    ? syntaxTree
    : makePartiallyElaboratedObjectNode(syntaxTree)
