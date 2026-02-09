import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../../errors.js'
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
        return either.flatMap(serialize(elaboratedCondition), condition => {
          if (containsAnyUnelaboratedNodes(condition)) {
            // The condition cannot yet be fully elaborated. Do a lightweight
            // pass through the branches to substitute `@lookup`s for their
            // values as much as possible. This helps in tricky situations
            // where referenced properties that are higher up in the program
            // get erased before the `@if` can be fully elaborated.
            const doNotElaborate = (expression: Expression) =>
              either.makeRight(asSemanticGraph(expression))

            const contextWhichOnlyElaboratesLookups: ExpressionContext = {
              ...context,
              keywordHandlers: {
                '@lookup': context.keywordHandlers['@lookup'],
                '@apply': doNotElaborate,
                '@check': doNotElaborate,
                '@function': doNotElaborate,
                '@if': doNotElaborate,
                '@index': doNotElaborate,
                '@panic': doNotElaborate,
                '@runtime': doNotElaborate,
                '@todo': doNotElaborate,
                '@union': doNotElaborate,
              },
            }

            const thenWithElaboratedLookups = either.unwrapOrElse(
              either.map(
                evaluateSubexpression(
                  subexpressionKeyPaths.then,
                  contextWhichOnlyElaboratesLookups,
                  ifExpression[1].then,
                ),
                asSemanticGraph,
              ),
              _error => ifExpression[1].then,
            )

            const elseWithElaboratedLookups = either.unwrapOrElse(
              either.map(
                evaluateSubexpression(
                  subexpressionKeyPaths.else,
                  contextWhichOnlyElaboratesLookups,
                  ifExpression[1].else,
                ),
                asSemanticGraph,
              ),
              _error => ifExpression[1].else,
            )

            return either.makeRight(
              makeIfExpression({
                condition: asSemanticGraph(condition),
                then: thenWithElaboratedLookups,
                else: elseWithElaboratedLookups,
              }),
            )
          } else {
            return either.makeLeft({
              kind: 'invalidExpression',
              message: 'condition was not boolean',
            })
          }
        })
      }
    })
  })

const evaluateSubexpression = (
  subKeyPath: KeyPath,
  context: ExpressionContext,
  subexpression: SemanticGraph,
) =>
  either.flatMap(serialize(subexpression), serializedSubexpression =>
    elaborateWithContext(serializedSubexpression, {
      keywordHandlers: context.keywordHandlers,
      program: context.program,
      location: [...context.location, ...subKeyPath],
    }),
  )
