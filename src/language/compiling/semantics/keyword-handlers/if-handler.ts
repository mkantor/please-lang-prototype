import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../../errors.js'
import {
  asSemanticGraph,
  containsAnyUnelaboratedNodes,
  elaborateWithContext,
  isExpression,
  isObjectNode,
  makeIfExpression,
  makeObjectNode,
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

    return either.flatMap(
      evaluateSubexpression(
        subexpressionKeyPaths.condition,
        context,
        ifExpression[1].condition,
      ),
      elaboratedCondition => {
        if (elaboratedCondition === 'true' || elaboratedCondition === 'false') {
          const branchKey = elaboratedCondition === 'true' ? 'then' : 'else'
          return either.map(
            evaluateSubexpression(
              subexpressionKeyPaths[branchKey],
              context,
              ifExpression[1][branchKey],
            ),
            asSemanticGraph,
          )
        } else {
          return either.flatMap(serialize(elaboratedCondition), condition => {
            if (containsAnyUnelaboratedNodes(condition)) {
              // The condition cannot yet be fully elaborated. Do a lightweight
              // pass through the branches to substitute `@lookup`s/`@index`es for
              // values as much as possible. This helps in tricky situations
              // where referenced properties that are higher up in the program
              // get erased before the `@if` can be fully elaborated.

              const doNotElaborate = either.makeRight
              const partiallyElaboratingContext: ExpressionContext = {
                ...context,
                keywordHandlers: {
                  '@lookup': context.keywordHandlers['@lookup'],
                  '@index': context.keywordHandlers['@index'],
                  '@apply': doNotElaborate,
                  '@check': doNotElaborate,
                  '@function': doNotElaborate,
                  '@if': doNotElaborate,
                  '@panic': doNotElaborate,
                  '@runtime': doNotElaborate,
                  '@signature': doNotElaborate,
                  '@todo': doNotElaborate,
                  '@union': doNotElaborate,
                },
              }

              const elaborateNestedIfLookups = (
                branch: SemanticGraph,
              ): SemanticGraph =>
                isExpression(branch) && branch['0'] === '@if' ?
                  either.unwrapOrElse(
                    ifKeywordHandler(branch, partiallyElaboratingContext),
                    _error => branch,
                  )
                : isExpression(branch) && branch['0'] === '@function' ? branch
                : isObjectNode(branch) ?
                  makeObjectNode(
                    Object.fromEntries(
                      Object.entries(branch).map(([key, value]) => [
                        key,
                        elaborateNestedIfLookups(value),
                      ]),
                    ),
                  )
                : branch

              const elaborateBranch = (
                branchKey: 'then' | 'else',
              ): SemanticGraph =>
                elaborateNestedIfLookups(
                  either.unwrapOrElse(
                    either.map(
                      evaluateSubexpression(
                        subexpressionKeyPaths[branchKey],
                        partiallyElaboratingContext,
                        ifExpression[1][branchKey],
                      ),
                      asSemanticGraph,
                    ),
                    _error => ifExpression[1][branchKey],
                  ),
                )

              return either.makeRight(
                makeIfExpression({
                  condition: asSemanticGraph(condition),
                  then: elaborateBranch('then'),
                  else: elaborateBranch('else'),
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
      },
    )
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
