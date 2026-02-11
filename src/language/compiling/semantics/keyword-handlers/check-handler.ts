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
import { showType } from '../../../semantics/type-system/show-type.js'
import { literalTypeFromSemanticGraph } from '../../../semantics/type-system/type-utilities.js'

export const checkKeywordHandler: KeywordHandler = (
  expression: Expression,
  _context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readCheckExpression(expression), ({ 1: { value, type } }) =>
    check({ value, type }),
  )

const check = ({
  value,
  type,
}: {
  readonly value: SemanticGraph
  readonly type: SemanticGraph
}): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(literalTypeFromSemanticGraph(value), valueAsType =>
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
