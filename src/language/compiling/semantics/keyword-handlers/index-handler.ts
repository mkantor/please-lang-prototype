import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import {
  applyKeyPathToSemanticGraph,
  applyKeyPathToType,
  containsAnyUnelaboratedNodes,
  inferType,
  isObjectNode,
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
  objectKey: string,
): Either<ElaborationError, undefined> =>
  either.flatMap(
    inferType(object, {
      ...context,
      location: [...context.location, '1', objectKey],
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
  either.flatMap(readIndexExpression(expression), indexExpression =>
    either.flatMap(keyPathFromObjectNode(indexExpression[1].query), keyPath => {
      const object = indexExpression[1].object
      // The original (un-canonicalized) expression's argument object may use
      // either named keys (`object`/`query`) or positional ones (`0`/`1`).
      const argument = expression[1]
      const objectKey =
        (
          argument !== undefined &&
          isObjectNode(argument) &&
          'object' in argument
        ) ?
          'object'
        : '0'
      return either.flatMap(
        checkKeyPathExistsInType(object, keyPath, context, objectKey),
        _ =>
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
      )
    }),
  )
