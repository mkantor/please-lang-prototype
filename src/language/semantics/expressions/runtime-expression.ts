import { either, type Either } from '../../../adts.js'
import type { ElaborationError } from '../../errors.js'
import { isExpression, type Expression } from '../expression.js'
import { isFunctionNode } from '../function-node.js'
import { makeUnelaboratedObjectNode } from '../object-node.js'
import {
  containsAnyUnelaboratedNodes,
  type SemanticGraph,
  type unelaboratedKey,
} from '../semantic-graph.js'
import {
  asSemanticGraph,
  readArgumentsFromExpression,
} from './expression-utilities.js'

export type RuntimeExpression = Expression & {
  readonly 0: '@runtime'
  readonly function: SemanticGraph
}

export const readRuntimeExpression = (
  node: SemanticGraph,
): Either<ElaborationError, RuntimeExpression> =>
  isExpression(node)
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
