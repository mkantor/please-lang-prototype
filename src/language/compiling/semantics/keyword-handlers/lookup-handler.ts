import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import {
  isObjectNode,
  lookup,
  readLookupExpression,
  stringifyKeyForEndUser,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'

export const lookupKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readLookupExpression(expression), ({ 1: { key } }) => {
    if (isObjectNode(context.program)) {
      return either.flatMap(lookup({ context, key }), possibleValue =>
        option.match(possibleValue, {
          none: () =>
            either.makeLeft({
              kind: 'invalidExpression',
              message: `property \`${stringifyKeyForEndUser(key)}\` not found`,
            }),
          some: either.makeRight,
        }),
      )
    } else {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: 'the program has no properties',
      })
    }
  })
