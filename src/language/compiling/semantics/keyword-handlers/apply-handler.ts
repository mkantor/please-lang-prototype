import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../../errors.js'
import {
  containedTypeParameters,
  containsAnyUnelaboratedNodes,
  inferType,
  isAssignable,
  isFunctionNode,
  readApplyExpression,
  resolveParameterTypes,
  showType,
  stringifySemanticGraphForEndUser,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
  type Type,
} from '../../../semantics.js'

const staticallyCheckArgument = (
  argument: SemanticGraph,
  parameterType: Type,
  context: ExpressionContext,
): Either<ElaborationError, undefined> =>
  (
    // Type inference does not yet instantiate type parameters from argument
    // types, so skip the static check for generic parameter types.
    // TODO: Implement type parameter instantiation.
    containedTypeParameters(parameterType).size > 0
  ) ?
    either.makeRight(undefined)
  : either.flatMap(
      inferType(argument, resolveParameterTypes(context), new Set(), context),
      argumentType =>
        (
          // For now, reject only when the argument's inferred type and the
          // parameter type are completely disjoint. The sound thing to do here
          // would be to only proceed when `argumentType` is assignable to
          // `parameterType` (and not the other way around), but progress is
          // needed elsewhere to allow extant programs to typecheck like that.
          // TODO: Revisit this once function parameter type annotations are
          // expressible in plz.
          isAssignable({ source: argumentType, target: parameterType }) ||
          isAssignable({ source: parameterType, target: argumentType })
        ) ?
          either.makeRight(undefined)
        : either.makeLeft({
            kind: 'typeMismatch',
            message: `the value \`${stringifySemanticGraphForEndUser(
              argument,
            )}\` is not assignable to the type \`${showType(parameterType)}\``,
          }),
    )

export const applyKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(
    readApplyExpression(expression),
    (applyExpression): Either<ElaborationError, SemanticGraph> => {
      const functionToApply = applyExpression[1].function
      const argument = applyExpression[1].argument

      const staticCheck: Either<ElaborationError, undefined> =
        isFunctionNode(functionToApply) ?
          staticallyCheckArgument(
            argument,
            functionToApply.signature.parameter,
            context,
          )
        : either.makeRight(undefined)

      return either.flatMap(
        staticCheck,
        (): Either<ElaborationError, SemanticGraph> => {
          if (containsAnyUnelaboratedNodes(argument)) {
            // The argument isn't ready, so keep the @apply unelaborated.
            return either.makeRight(applyExpression)
          } else if (isFunctionNode(functionToApply)) {
            const result = functionToApply(argument)
            if (either.isLeft(result)) {
              if (result.value.kind === 'dependencyUnavailable') {
                // Keep the @apply unelaborated.
                return either.makeRight(applyExpression)
              } else {
                return either.makeLeft(result.value)
              }
            } else {
              return result
            }
          } else if (containsAnyUnelaboratedNodes(functionToApply)) {
            // The function isn't ready, so keep the @apply unelaborated.
            return either.makeRight(applyExpression)
          } else {
            return either.makeLeft({
              kind: 'invalidExpression',
              message: 'only functions can be applied',
            })
          }
        },
      )
    },
  )
