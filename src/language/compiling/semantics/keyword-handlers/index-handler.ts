import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import {
  applyKeyPathToSemanticGraph,
  applyKeyPathToType,
  containsAnyUnelaboratedNodes,
  inferType,
  keyPathFromObjectNodeOrMolecule,
  readIndexExpression,
  resolveParameterTypes,
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
    inferType(object, resolveParameterTypes(context), new Set(), context),
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
    either.flatMap(
      keyPathFromObjectNodeOrMolecule(indexExpression[1].query),
      keyPath => {
        const object = indexExpression[1].object
        return either.flatMap(
          checkKeyPathExistsInType(object, keyPath, context),
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
      },
    ),
  )
