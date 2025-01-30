import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Molecule } from '../../parsing.js'
import { isSpecificExpression } from '../expression.js'
import { isFunctionNode } from '../function-node.js'
import { makeUnelaboratedObjectNode, type ObjectNode } from '../object-node.js'
import {
  containsAnyUnelaboratedNodes,
  type SemanticGraph,
  type unelaboratedKey,
} from '../semantic-graph.js'
import {
  asSemanticGraph,
  readArgumentsFromExpression,
} from './expression-utilities.js'

export type RuntimeExpression = ObjectNode & {
  readonly 0: '@runtime'
  readonly function: SemanticGraph
}

export const readRuntimeExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, RuntimeExpression> =>
  isSpecificExpression('@runtime', node)
    ? either.flatMap(
        readArgumentsFromExpression(node, [['function', '1']]),
        ([f]) => {
          const runtimeFunction = asSemanticGraph(f)
          if (
            !(
              isFunctionNode(runtimeFunction) || containsAnyUnelaboratedNodes(f)
            )
          ) {
            return either.makeLeft({
              kind: 'invalidExpression',
              message: 'runtime functions must compute something',
            })
          } else {
            return either.makeRight(makeRuntimeExpression(runtimeFunction))
          }
        },
      )
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not an expression',
      })

export const makeRuntimeExpression = (
  f: SemanticGraph,
): RuntimeExpression & { readonly [unelaboratedKey]: true } =>
  makeUnelaboratedObjectNode({
    0: '@runtime',
    function: f,
  })
