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
  type KeyPath,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'

export const ifKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readIfExpression(expression), ifExpression => {
    // TODO: Make this less ad-hoc.
    if (
      !('1' in expression) ||
      typeof expression[1] !== 'object' ||
      expression[1] === null
    ) {
      throw new Error(
        '`@if` expression was invalid after being validated. This is a bug!',
      )
    }
    const subexpressionKeyPaths = {
      // Note: this must be kept in alignment with `readIfExpression`.
      condition: ['1', 'condition' in expression[1] ? 'condition' : '0'],
      then: ['1', 'then' in expression[1] ? 'then' : '1'],
      else: ['1', 'else' in expression[1] ? 'else' : '2'],
    }

    const elaboratedCondition = evaluateSubexpression(
      subexpressionKeyPaths.condition,
      context,
      ifExpression[1].condition,
    )

    return either.flatMap(elaboratedCondition, elaboratedCondition => {
      if (elaboratedCondition === 'true') {
        return either.map(
          evaluateSubexpression(
            subexpressionKeyPaths.then,
            context,
            ifExpression[1].then,
          ),
          asSemanticGraph,
        )
      } else if (elaboratedCondition === 'false') {
        return either.map(
          evaluateSubexpression(
            subexpressionKeyPaths.else,
            context,
            ifExpression[1].else,
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
                  ...ifExpression[1],
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
  subKeyPath: KeyPath,
  context: ExpressionContext,
  subexpression: SemanticGraph | Molecule,
) =>
  either.flatMap(
    serialize(asSemanticGraph(subexpression)),
    serializedSubexpression =>
      elaborateWithContext(serializedSubexpression, {
        keywordHandlers: context.keywordHandlers,
        program: context.program,
        location: [...context.location, ...subKeyPath],
      }),
  )
