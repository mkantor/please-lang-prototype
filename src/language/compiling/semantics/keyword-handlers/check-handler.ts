import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../../errors.js'
import {
  asSemanticGraph,
  isAssignable,
  readCheckExpression,
  serialize,
  stringifySemanticGraphForEndUser,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'
import { literalTypeFromAtomOrMolecule } from '../../../semantics/type-system/type-utilities.js'

export const checkKeywordHandler: KeywordHandler = (
  expression: Expression,
  _context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readCheckExpression(expression), ({ 1: { value, type } }) =>
    check({
      value: asSemanticGraph(value),
      type: asSemanticGraph(type),
    }),
  )

const check = ({
  value,
  type,
}: {
  readonly value: SemanticGraph
  readonly type: SemanticGraph
}): Either<ElaborationError, SemanticGraph> => {
  if (
    isAssignable({
      source: literalTypeFromAtomOrMolecule(serialize(value)),
      target: literalTypeFromAtomOrMolecule(serialize(type)),
    })
  ) {
    return either.makeRight(value)
  } else {
    return either.makeLeft({
      kind: 'typeMismatch',
      message: `the value \`${stringifySemanticGraphForEndUser(
        value,
      )}\` is not assignable to the type \`${stringifySemanticGraphForEndUser(
        type,
      )}\``,
    })
  }
}
