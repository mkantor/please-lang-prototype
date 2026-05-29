import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../../errors.js'
import {
  isAssignable,
  isObjectNode,
  readCheckExpression,
  showType,
  stringifySemanticGraphForEndUser,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'
import {
  inferType,
  literalTypeFromSemanticGraph,
} from '../../../semantics/type-system.js'

const check = ({
  value,
  type,
  context,
  valueKey,
}: {
  readonly value: SemanticGraph
  readonly type: SemanticGraph
  readonly context: ExpressionContext
  readonly valueKey: string
}): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(
    inferType(value, {
      ...context,
      location: [...context.location, '1', valueKey],
    }),
    valueAsType =>
      either.flatMap(literalTypeFromSemanticGraph(type), typeAsType => {
        if (
          isAssignable({
            source: valueAsType,
            target: typeAsType,
          })
        ) {
          return either.makeRight(value)
        } else {
          return either.makeLeft({
            kind: 'typeMismatch',
            message: `the value \`${stringifySemanticGraphForEndUser(
              value,
            )}\` (inferred to have type \`${showType(valueAsType)}\`) is not assignable to the type \`${showType(typeAsType)}\``,
          })
        }
      }),
  )

export const checkKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readCheckExpression(expression), ({ 1: { value, type } }) => {
    // The original (un-canonicalized) expression's argument object may use
    // either named keys (`value`/`type`) or positional ones (`0`/`1`).
    const argument = expression[1]
    const valueKey =
      argument !== undefined && isObjectNode(argument) && 'value' in argument ?
        'value'
      : '0'
    return check({ value, type, context, valueKey })
  })
