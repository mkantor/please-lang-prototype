import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Molecule } from '../../parsing.js'
import { isKeywordExpressionWithArgument } from '../expression.js'
import { isFunctionNode } from '../function-node.js'
import { makeObjectNode, type ObjectNode } from '../object-node.js'
import {
  containsAnyUnelaboratedNodes,
  type SemanticGraph,
} from '../semantic-graph.js'
import {
  asSemanticGraph,
  readArgumentsFromExpression,
} from './expression-utilities.js'

export type RuntimeExpression = ObjectNode & {
  readonly 0: '@runtime'
  readonly 1: {
    readonly function: SemanticGraph
  }
}

export const readRuntimeExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, RuntimeExpression> =>
  isKeywordExpressionWithArgument('@runtime', node)
    ? either.flatMap(readArgumentsFromExpression(node, ['function']), ([f]) => {
        const runtimeFunction = asSemanticGraph(f)
        if (
          !(isFunctionNode(runtimeFunction) || containsAnyUnelaboratedNodes(f))
        ) {
          return either.makeLeft({
            kind: 'invalidExpression',
            message: 'runtime functions must compute something',
          })
        } else {
          return either.makeRight(makeRuntimeExpression(runtimeFunction))
        }
      })
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not an expression',
      })

export const makeRuntimeExpression = (f: SemanticGraph): RuntimeExpression =>
  makeObjectNode({
    0: '@runtime',
    1: makeObjectNode({ function: f }),
  })
