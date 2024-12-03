import { either, option, type Either, type Option } from '../../adts.js'
import { withPhantomData, type WithPhantomData } from '../../phantom-data.js'
import type {
  InvalidExpressionError,
  UnserializableValueError,
} from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { serializeFunctionNode, type FunctionNode } from './function-node.js'
import { stringifyKeyPathForEndUser, type KeyPath } from './key-path.js'
import {
  lookupPropertyOfObjectNode,
  makeObjectNode,
  serializeObjectNode,
  type ObjectNode,
} from './object-node.js'

export const nodeTag = Symbol('nodeTag')

export const unelaboratedKey = Symbol('unelaborated')

export type SemanticGraph = Atom | FunctionNode | ObjectNode

export const applyKeyPathToSemanticGraph = (
  node: SemanticGraph,
  keyPath: KeyPath,
): Option<SemanticGraph> => {
  const [firstKey, ...remainingKeyPath] = keyPath
  if (firstKey === undefined) {
    return option.makeSome(node)
  } else {
    return matchSemanticGraph(node, {
      atom: _ => option.none,
      function: _ => option.none,
      object: graph => {
        if (typeof firstKey === 'symbol') {
          return option.none
        } else {
          const next = graph[firstKey]
          if (next === undefined) {
            return option.none
          } else {
            return applyKeyPathToSemanticGraph(
              isSemanticGraph(next) ? next : syntaxTreeToSemanticGraph(next),
              remainingKeyPath,
            )
          }
        }
      },
    })
  }
}

export const updateValueAtKeyPathInSemanticGraphIfValid = (
  value: SemanticGraph,
  keyPath: KeyPath,
  operation: (valueAtKeyPath: SemanticGraph) => SemanticGraph,
): SemanticGraph => {
  const [firstKey, ...remainingKeyPath] = keyPath
  if (firstKey === undefined) {
    // If the key path is empty, this is the value to operate on.
    return operation(value)
  } else {
    return matchSemanticGraph(value, {
      atom: (node): SemanticGraph => node,
      function: node => node,
      object: node => {
        if (typeof firstKey === 'string') {
          return option.match(lookupPropertyOfObjectNode(firstKey, node), {
            none: () => node,
            some: propertyValue =>
              makeObjectNode({
                ...node,
                [firstKey]: updateValueAtKeyPathInSemanticGraphIfValid(
                  propertyValue,
                  remainingKeyPath,
                  operation,
                ),
              }),
          })
        } else {
          return node
        }
      },
    })
  }
}

export const containsAnyUnelaboratedNodes = (
  node: SemanticGraph | Molecule,
): boolean => {
  if (
    typeof node !== 'string' &&
    unelaboratedKey in node &&
    node[unelaboratedKey] === true
  ) {
    return true
  } else if (typeof node === 'object') {
    for (const propertyValue of Object.values(node)) {
      if (containsAnyUnelaboratedNodes(propertyValue) === true) {
        return true
      }
    }
    return false
  } else {
    return false
  }
}

export const extractStringValueIfPossible = (
  node: SemanticGraph | Molecule,
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

export const updateValueAtKeyPathInSemanticGraph = (
  node: SemanticGraph,
  keyPath: KeyPath,
  operation: (valueAtKeyPath: SemanticGraph) => SemanticGraph,
): Either<InvalidExpressionError, SemanticGraph> => {
  const [firstKey, ...remainingKeyPath] = keyPath
  if (firstKey === undefined) {
    // If the key path is empty, this is the value to operate on.
    return either.makeRight(operation(node))
  } else {
    return matchSemanticGraph(node, {
      atom: _ => either.makeLeft(makePropertyNotFoundError(keyPath)),
      function: _ => either.makeLeft(makePropertyNotFoundError(keyPath)),
      object: node => {
        if (typeof firstKey === 'symbol') {
          return either.makeLeft(makePropertyNotFoundError(keyPath))
        } else {
          const next = node[firstKey]
          if (next === undefined) {
            return either.makeLeft(makePropertyNotFoundError(keyPath))
          } else {
            return either.map(
              updateValueAtKeyPathInSemanticGraph(
                isSemanticGraph(next) ? next : syntaxTreeToSemanticGraph(next),
                remainingKeyPath,
                operation,
              ),
              updatedNode =>
                makeObjectNode({
                  ...node,
                  [firstKey]: updatedNode,
                }),
            )
          }
        }
      },
    })
  }
}

export const matchSemanticGraph = <Result>(
  semanticGraph: SemanticGraph,
  cases: {
    atom: (node: Atom) => Result
    function: (node: FunctionNode) => Result
    object: (node: ObjectNode) => Result
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
  node: SemanticGraph,
): Either<UnserializableValueError, Output> =>
  either.map(
    matchSemanticGraph(node, {
      atom: (node): Either<UnserializableValueError, Atom | Molecule> =>
        either.makeRight(node),
      function: node => serializeFunctionNode(node),
      object: node => serializeObjectNode(node),
    }),
    withPhantomData<Serialized>(),
  )

export const isSemanticGraph = (
  value:
    | Atom
    | Molecule
    | {
        readonly [nodeTag]?: Exclude<SemanticGraph, Atom>[typeof nodeTag]
      },
): value is SemanticGraph =>
  typeof value === 'string' ||
  ((typeof value === 'object' || typeof value === 'function') &&
    nodeTag in value &&
    typeof value[nodeTag] === 'string')

const syntaxTreeToSemanticGraph = (
  syntaxTree: Atom | Molecule,
): ObjectNode | Atom =>
  typeof syntaxTree === 'string' ? syntaxTree : makeObjectNode(syntaxTree)
