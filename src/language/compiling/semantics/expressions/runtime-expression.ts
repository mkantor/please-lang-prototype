import { either, type Either } from '../../../../adts.js'
import type { ElaborationError } from '../../../errors.js'
import {
  isAssignable,
  isExpression,
  isFunctionNode,
  makeUnelaboratedObjectNode,
  replaceAllTypeParametersWithTheirConstraints,
  types,
  type Expression,
} from '../../../semantics.js'
import {
  type ExpressionContext,
  type KeywordHandler,
} from '../../../semantics/expression-elaboration.js'
import {
  containsAnyUnelaboratedNodes,
  type SemanticGraph,
  type unelaboratedKey,
} from '../../../semantics/semantic-graph.js'
import {
  asSemanticGraph,
  readArgumentsFromExpression,
} from './expression-utilities.js'

export const runtimeKeyword = '@runtime'

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

export const runtimeKeywordHandler: KeywordHandler = (
  expression: Expression,
  _context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readRuntimeExpression(expression), ({ function: f }) => {
    const runtimeFunction = asSemanticGraph(f)
    if (isFunctionNode(runtimeFunction)) {
      const runtimeFunctionSignature = runtimeFunction.signature
      return !isAssignable({
        source: types.runtimeContext,
        target: replaceAllTypeParametersWithTheirConstraints(
          runtimeFunctionSignature.parameter,
        ),
      })
        ? either.makeLeft({
            kind: 'typeMismatch',
            message: '@runtime function must accept a runtime context argument',
          })
        : either.makeRight(makeRuntimeExpression(f))
    } else {
      // TODO: Type-check unelaborated nodes.
      return either.makeRight(makeRuntimeExpression(f))
    }
  })
