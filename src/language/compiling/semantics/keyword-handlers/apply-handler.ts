import { either, type Either } from '../../../../adts.js'
import type { ElaborationError } from '../../../errors.js'
import {
  asSemanticGraph,
  isFunctionNode,
  readApplyExpression,
  type Expression,
} from '../../../semantics.js'
import {
  type ExpressionContext,
  type KeywordHandler,
} from '../../../semantics/expression-elaboration.js'
import {
  containsAnyUnelaboratedNodes,
  type SemanticGraph,
} from '../../../semantics/semantic-graph.js'

export const applyKeywordHandler: KeywordHandler = (
  expression: Expression,
  _context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(
    readApplyExpression(expression),
    (applyExpression): Either<ElaborationError, SemanticGraph> => {
      if (containsAnyUnelaboratedNodes(applyExpression.argument)) {
        // The argument isn't ready, so keep the @apply unelaborated.
        return either.makeRight(applyExpression)
      } else {
        const functionToApply = asSemanticGraph(applyExpression.function)
        if (isFunctionNode(functionToApply)) {
          const result = functionToApply(
            asSemanticGraph(applyExpression.argument),
          )
          if (either.isLeft(result)) {
            if (result.value.kind === 'dependencyUnavailable') {
              // Keep the @apply unelaborated.
              return either.makeRight(applyExpression)
            } else {
              return either.makeLeft(result.value)
            }
          } else {
            return result
          }
        } else if (containsAnyUnelaboratedNodes(functionToApply)) {
          // The function isn't ready, so keep the @apply unelaborated.
          return either.makeRight(applyExpression)
        } else {
          return either.makeLeft({
            kind: 'invalidExpression',
            message: 'only functions can be applied',
          })
        }
      }
    },
  )
