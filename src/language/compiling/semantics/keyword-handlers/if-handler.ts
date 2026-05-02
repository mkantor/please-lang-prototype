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
                  '@check': context.keywordHandlers['@check'],
                  '@apply': analyzeButPreserveExpression(
                    context.keywordHandlers['@apply'],
                  ),
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
              ): Either<ElaborationError, SemanticGraph> =>
                isExpression(branch) && branch['0'] === '@if' ?
                  ifKeywordHandler(branch, partiallyElaboratingContext)
                : isExpression(branch) && branch['0'] === '@function' ?
                  either.makeRight(branch)
                : isObjectNode(branch) ?
                  either.map(
                    sequenceEithers(
                      Object.entries(branch).map(([key, value]) =>
                        either.map(
                          elaborateNestedIfLookups(value),
                          elaboratedValue => [key, elaboratedValue] as const,
                        ),
                      ),
                    ),
                    entries => makeObjectNode(Object.fromEntries(entries)),
                  )
                : either.makeRight(branch)

              const elaborateBranch = (
                branchKey: 'then' | 'else',
              ): Either<ElaborationError, SemanticGraph> =>
                either.flatMap(
                  either.map(
                    evaluateSubexpression(
                      subexpressionKeyPaths[branchKey],
                      partiallyElaboratingContext,
                      ifExpression[1][branchKey],
                    ),
                    asSemanticGraph,
                  ),
                  elaborateNestedIfLookups,
                )

              return either.map(
                sequenceEithers([
                  elaborateBranch('then'),
                  elaborateBranch('else'),
                ]),
                ([elaboratedThen, elaboratedElse]) =>
                  makeIfExpression({
                    condition: asSemanticGraph(condition),
                    then: elaboratedThen,
                    else: elaboratedElse,
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

// Run a keyword handler for its static analysis, but preserve the original
// expression.
const analyzeButPreserveExpression =
  (handler: KeywordHandler): KeywordHandler =>
  (expression, context) =>
    either.match(handler(expression, context), {
      right: _ => either.makeRight(expression),
      left: error =>
        error.kind === 'typeMismatch' ?
          either.makeLeft(error)
        : either.makeRight(expression),
    })

// TODO: Consider adding this to @matt.kantor/either (and a similar function to
// @matt.kantor/option):
const sequenceEithers = <
  const Eithers extends readonly Either<unknown, unknown>[],
>(
  eithers: Eithers,
): SequenceOutput<Eithers> => {
  type LeftValue = LeftValueOf<Eithers[number]>
  type RightValue = RightValueOf<Eithers[number]>

  const output: RightValueOf<Eithers[number]>[] = []
  for (const singleEither of eithers) {
    // TypeScript unfortunately widens `either` to its constraint, but we know
    // it conforms to this type.
    const narrowedEither = singleEither as Either<LeftValue, RightValue>
    if (either.isLeft(narrowedEither)) {
      return narrowedEither
    } else {
      output.push(narrowedEither.value)
    }
  }

  // TypeScript doesn't keep track of how many eithers we've visited, but we
  // know it's the same amount that were given as input.
  const knownNumberOfOutputs = output as RightValueOf<SequenceOutput<Eithers>>
  return either.makeRight(knownNumberOfOutputs)
}

type SequenceOutput<Eithers extends readonly Either<unknown, unknown>[]> =
  Either<
    LeftValueOf<Eithers[number]>,
    { -readonly [Index in keyof Eithers]: RightValueOf<Eithers[Index]> }
  > &
    unknown // Hide `SequenceOutput` from type info.

type RightValueOf<SpecificEither extends Either<unknown, unknown>> =
  SpecificEither extends { kind: 'right'; value: infer RightValue } ? RightValue
  : never

type LeftValueOf<SpecificEither extends Either<unknown, unknown>> =
  SpecificEither extends { kind: 'left'; value: infer LeftValue } ? LeftValue
  : never
