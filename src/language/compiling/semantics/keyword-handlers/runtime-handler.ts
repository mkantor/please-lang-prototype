import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../../errors.js'
import {
  isAssignable,
  isFunctionNode,
  makeRuntimeExpression,
  readRuntimeExpression,
  replaceAllTypeParametersWithTheirConstraints,
  types,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'

export const runtimeKeywordHandler: KeywordHandler = (
  expression: Expression,
  _context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(
    readRuntimeExpression(expression),
    ({ 1: { function: runtimeFunction } }) => {
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
              message:
                '@runtime function must accept a runtime context argument',
            })
          : either.makeRight(makeRuntimeExpression(runtimeFunction))
      } else {
        // TODO: Type-check unelaborated nodes.
        return either.makeRight(makeRuntimeExpression(runtimeFunction))
      }
    },
  )
