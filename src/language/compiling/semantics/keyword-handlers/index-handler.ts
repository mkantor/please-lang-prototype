import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import {
  applyKeyPathToSemanticGraph,
  asSemanticGraph,
  keyPathFromObjectNodeOrMolecule,
  readIndexExpression,
  stringifyKeyPathForEndUser,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'

export const indexKeywordHandler: KeywordHandler = (
  expression: Expression,
  _context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readIndexExpression(expression), ({ object, query }) =>
    either.flatMap(keyPathFromObjectNodeOrMolecule(query), keyPath =>
      option.match(
        applyKeyPathToSemanticGraph(asSemanticGraph(object), keyPath),
        {
          none: () =>
            either.makeLeft({
              kind: 'invalidExpression',
              message: `property \`${stringifyKeyPathForEndUser(
                keyPath,
              )}\` not found`,
            }),
          some: either.makeRight,
        },
      ),
    ),
  )
