import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import {
  applyKeyPathToType,
  containsAnyUnelaboratedNodes,
  inferType,
  readIndexExpression,
  showType,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'
import { applyTypeKeyPathToSemanticGraph } from '../../../semantics/semantic-graph.js'
import {
  stringifyTypeKeyPathForEndUser,
  typeKeyPathFromObjectNode,
  type TypeKeyPath,
} from '../../../semantics/type-system.js'

const checkKeyPathExistsInType = (
  object: SemanticGraph,
  keyPath: TypeKeyPath,
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
            message: `property \`${stringifyTypeKeyPathForEndUser(
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
    return either.flatMap(
      typeKeyPathFromObjectNode(
        query,
        { ...context, location: [...context.location, '1', 'query'] },
        inferType,
      ),
      typeKeyPath => {
        return either.flatMap(
          checkKeyPathExistsInType(object, typeKeyPath, context),
          _ =>
            (
              containsAnyUnelaboratedNodes(object) ||
              containsAnyUnelaboratedNodes(query)
            ) ?
              // The object isn't ready, so keep the @index unelaborated.
              either.makeRight(indexExpression)
            : option.match(
                applyTypeKeyPathToSemanticGraph(object, typeKeyPath),
                {
                  none: () =>
                    either.makeLeft({
                      kind: 'typeMismatch',
                      message: `property \`${stringifyTypeKeyPathForEndUser(
                        typeKeyPath,
                      )}\` not found`,
                    }),
                  some: either.makeRight,
                },
              ),
        )
      },
    )
  })
