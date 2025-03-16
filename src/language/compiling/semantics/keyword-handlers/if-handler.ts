import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../../errors.js'
import type { Molecule } from '../../../parsing.js'
import {
  asSemanticGraph,
  containsAnyUnelaboratedNodes,
  elaborateWithContext,
  makeIfExpression,
  readIfExpression,
  serialize,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'

export const ifKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readIfExpression(expression), ifExpression => {
    const expressionKeys = {
      // Note: this must be kept in alignment with `readIfExpression`.
      condition: 'condition' in expression ? 'condition' : '1',
      then: 'then' in expression ? 'then' : '2',
      else: 'else' in expression ? 'else' : '3',
    }

    const elaboratedCondition = evaluateSubexpression(
      expressionKeys.condition,
      context,
      ifExpression.condition,
    )

    return either.flatMap(elaboratedCondition, elaboratedCondition => {
      if (elaboratedCondition === 'true') {
        return either.map(
          evaluateSubexpression(
            expressionKeys.then,
            context,
            ifExpression.then,
          ),
          asSemanticGraph,
        )
      } else if (elaboratedCondition === 'false') {
        return either.map(
          evaluateSubexpression(
            expressionKeys.else,
            context,
            ifExpression.else,
          ),
          asSemanticGraph,
        )
      } else {
        return either.flatMap(
          serialize(elaboratedCondition),
          elaboratedCondition => {
            if (containsAnyUnelaboratedNodes(elaboratedCondition)) {
              // Return an unelaborated `@if` expression.
              return either.makeRight(
                makeIfExpression({
                  ...ifExpression,
                  condition: elaboratedCondition,
                }),
              )
            } else {
              return either.makeLeft({
                kind: 'invalidExpression',
                message: 'condition was not boolean',
              })
            }
          },
        )
      }
    })
  })

const evaluateSubexpression = (
  key: string,
  context: ExpressionContext,
  subexpression: SemanticGraph | Molecule,
) =>
  either.flatMap(
    serialize(asSemanticGraph(subexpression)),
    serializedSubexpression =>
      elaborateWithContext(serializedSubexpression, {
        keywordHandlers: context.keywordHandlers,
        program: context.program,
        location: [...context.location, key],
      }),
  )
