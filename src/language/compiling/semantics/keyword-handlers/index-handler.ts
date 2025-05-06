import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import {
  applyKeyPathToSemanticGraph,
  asSemanticGraph,
  containsAnyUnelaboratedNodes,
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
  either.flatMap(readIndexExpression(expression), indexExpression =>
    either.flatMap(
      keyPathFromObjectNodeOrMolecule(indexExpression[1].query),
      keyPath => {
        if (containsAnyUnelaboratedNodes(indexExpression[1].object)) {
          // The object isn't ready, so keep the @index unelaborated.
          return either.makeRight(indexExpression)
        } else {
          return option.match(
            applyKeyPathToSemanticGraph(
              asSemanticGraph(indexExpression[1].object),
              keyPath,
            ),
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
          )
        }
      },
    ),
  )
