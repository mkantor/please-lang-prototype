import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../../errors.js'
import {
  stringifySemanticGraphForEndUser,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'

export const panicKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  context.panicsAreDeferred ?
    either.makeRight(expression)
  : either.makeLeft({
      kind: 'panic',
      message: stringifySemanticGraphForEndUser(expression),
    })
