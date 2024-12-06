import { either, type Either } from '../../../../adts.js'
import type { ElaborationError } from '../../../errors.js'
import {
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
} from '../../../semantics/expression-elaboration.js'
import { makeObjectNode } from '../../../semantics/object-node.js'
import { type SemanticGraph } from '../../../semantics/semantic-graph.js'

export const todoKeyword = '@todo'

export type TodoExpression = Expression & {
  readonly 0: '@todo'
}

export const todoKeywordHandler: KeywordHandler = (
  _expression: Expression,
  _context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.makeRight(makeObjectNode({}))
