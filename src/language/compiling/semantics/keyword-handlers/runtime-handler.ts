import { either, type Either } from '../../../../adts.js'
import type { ElaborationError } from '../../../errors.js'
import {
  asSemanticGraph,
  isAssignable,
  isFunctionNode,
  makeRuntimeExpression,
  readRuntimeExpression,
  replaceAllTypeParametersWithTheirConstraints,
  types,
  type Expression,
} from '../../../semantics.js'
import {
  type ExpressionContext,
  type KeywordHandler,
} from '../../../semantics/expression-elaboration.js'
import { type SemanticGraph } from '../../../semantics/semantic-graph.js'

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
