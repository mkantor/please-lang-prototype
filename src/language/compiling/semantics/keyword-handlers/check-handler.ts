import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../../errors.js'
import {
  isAssignable,
  readCheckExpression,
  stringifySemanticGraphForEndUser,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'
import {
  inferType,
  literalTypeFromSemanticGraph,
  resolveParameterTypes,
  showType,
} from '../../../semantics/type-system.js'

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
    inferType(value, resolveParameterTypes(context), new Set(), context),
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
            )}\` is not assignable to the type \`${showType(typeAsType)}\``,
          })
        }
      }),
  )

export const checkKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readCheckExpression(expression), ({ 1: { value, type } }) =>
    check({ value, type, context }),
  )
