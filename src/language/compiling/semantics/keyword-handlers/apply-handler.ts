import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../../errors.js'
import {
  containedTypeParameters,
  containsAnyUnelaboratedNodes,
  getTypesForTypeParameters,
  inferType,
  isAssignable,
  isFunctionNode,
  readApplyExpression,
  resolveParameterTypes,
  showType,
  stringifySemanticGraphForEndUser,
  supplyTypeArguments,
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
  either.flatMap(
    inferType(argument, resolveParameterTypes(context), new Set(), context),
    argumentType => {
      // Instantiate type parameters contained in `parameterType` before the
      // assignability check.
      const instantiatedParameterType = supplyTypeArguments(
        parameterType,
        getTypesForTypeParameters({ parameterType, argumentType }),
      )
      return (
        (
          // Skip checking when the argument's inferred type contains type
          // parameters (e.g. a lookup of an unannotated function parameter,
          // which `resolveParameterTypes` infers as a type parameter).
          // TODO: Implement enough type parameter instantiation logic to
          // eliminate this hack.
          containedTypeParameters(argumentType).size > 0
        ) ?
          either.makeRight(undefined)
        : (
          isAssignable({
            source: argumentType,
            target: instantiatedParameterType,
          })
        ) ?
          either.makeRight(undefined)
        : either.makeLeft({
            kind: 'typeMismatch',
            message: `the value \`${stringifySemanticGraphForEndUser(
              argument,
            )}\` is not assignable to the type \`${showType(parameterType)}\``,
          })
      )
    },
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
