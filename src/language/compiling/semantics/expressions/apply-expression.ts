import { either, type Either } from '../../../../adts.js'
import type { ElaborationError } from '../../../errors.js'
import type { Molecule } from '../../../parsing.js'
import {
  isExpression,
  isFunctionNode,
  makeUnelaboratedObjectNode,
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

export const applyKeyword = '@apply'

export type ApplyExpression = Expression & {
  readonly 0: '@apply'
  readonly function: SemanticGraph | Molecule
  readonly argument: SemanticGraph | Molecule
}

export const readApplyExpression = (
  node: SemanticGraph,
): Either<ElaborationError, ApplyExpression> =>
  isExpression(node)
    ? either.map(
        readArgumentsFromExpression(node, [
          ['function', '1'],
          ['argument', '2'],
        ]),
        ([f, argument]) => makeApplyExpression({ function: f, argument }),
      )
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not an expression',
      })

export const makeApplyExpression = ({
  function: f,
  argument,
}: {
  readonly function: SemanticGraph | Molecule
  readonly argument: SemanticGraph | Molecule
}): ApplyExpression & { readonly [unelaboratedKey]: true } =>
  makeUnelaboratedObjectNode({
    0: '@apply',
    function: f,
    argument,
  })

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
