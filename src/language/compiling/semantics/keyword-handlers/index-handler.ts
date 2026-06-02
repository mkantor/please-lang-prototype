import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import {
  applyKeyPathToSemanticGraph,
  applyKeyPathToType,
  containsAnyUnelaboratedNodes,
  inferType,
  keyPathFromObjectNode,
  readIndexExpression,
  showType,
  stringifyKeyPathForEndUser,
  type Expression,
  type ExpressionContext,
  type KeyPath,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'

const checkKeyPathExistsInType = (
  object: SemanticGraph,
  keyPath: KeyPath,
  context: ExpressionContext,
): Either<ElaborationError, undefined> =>
  either.flatMap(
    inferType(object, {
      ...context,
      location: [...context.location, '1', 'object'],
    }),
    objectType => {
      const typeAtKeyPath = applyKeyPathToType(objectType, keyPath)
      return (
          typeAtKeyPath.kind === 'union' && typeAtKeyPath.members.size === 0
        ) ?
          either.makeLeft({
            kind: 'typeMismatch',
            message: `property \`${stringifyKeyPathForEndUser(
              keyPath,
            )}\` does not exist on type \`${showType(objectType)}\``,
          })
        : either.makeRight(undefined)
    },
  )

export const indexKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readIndexExpression(expression), indexExpression => {
    const {
      1: { object, query },
    } = indexExpression
    return either.flatMap(keyPathFromObjectNode(query), keyPath =>
      either.flatMap(checkKeyPathExistsInType(object, keyPath, context), _ =>
        containsAnyUnelaboratedNodes(object) ?
          // The object isn't ready, so keep the @index unelaborated.
          either.makeRight(indexExpression)
        : option.match(applyKeyPathToSemanticGraph(object, keyPath), {
            none: () =>
              either.makeLeft({
                kind: 'typeMismatch',
                message: `property \`${stringifyKeyPathForEndUser(
                  keyPath,
                )}\` not found`,
              }),
            some: either.makeRight,
          }),
      ),
    )
  })
