import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../../errors.js'
import {
  isAssignable,
  readCheckExpression,
  stringifySemanticGraphForEndUser,
  stringifyTypeForEndUser,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'
import { inferType } from '../../../semantics/type-system.js'

const check = ({
  value,
  type,
  context,
}: {
  readonly value: SemanticGraph
  readonly type: SemanticGraph
  readonly context: ExpressionContext
}): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(
    inferType(value, {
      ...context,
      location: [...context.location, '1', 'value'],
    }),
    valueAsType =>
      either.flatMap(
        inferType(type, {
          ...context,
          location: [...context.location, '1', 'type'],
        }),
        typeAsType => {
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
              )}\` (inferred to have type \`${stringifyTypeForEndUser(valueAsType)}\`) is not assignable to the type \`${stringifyTypeForEndUser(typeAsType)}\``,
            })
          }
        },
      ),
  )

export const checkKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readCheckExpression(expression), ({ 1: { value, type } }) =>
    check({ value, type, context }),
  )
