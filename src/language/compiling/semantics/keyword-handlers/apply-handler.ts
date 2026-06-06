import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import {
  applicableFunctionSignatures,
  containsAnyUnelaboratedNodes,
  getTypesForTypeParameters,
  inferType,
  isAssignable,
  isFunctionNode,
  readApplyExpression,
  stringifySemanticGraphForEndUser,
  stringifyTypeForEndUser,
  supplyTypeArguments,
  type Expression,
  type ExpressionContext,
  type KeywordHandler,
  type SemanticGraph,
  type Type,
} from '../../../semantics.js'

const checkArgumentType = (
  argument: SemanticGraph,
  parameterType: Type,
  context: ExpressionContext,
): Either<ElaborationError, undefined> =>
  either.flatMap(
    inferType(argument, {
      ...context,
      location: [...context.location, '1', 'argument'],
    }),
    argumentType => {
      // Instantiate type parameters contained in `parameterType` before the
      // assignability check.
      const instantiatedParameterType = supplyTypeArguments(
        parameterType,
        getTypesForTypeParameters({ parameterType, argumentType }),
      )
      return (
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
            )}\` (inferred to have type \`${stringifyTypeForEndUser(argumentType)}\`) is not assignable to the type \`${stringifyTypeForEndUser(parameterType)}\``,
          })
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

      const argumentTypeCheck = either.flatMap(
        inferType(functionToApply, {
          ...context,
          location: [...context.location, '1', 'function'],
        }),
        functionType =>
          option.match(applicableFunctionSignatures(functionType), {
            // The function may resolve to several possible signatures (e.g. if
            // it's a union of function types). The argument must be compatible
            // with all possible parameter types.
            some: signatures =>
              either.map(
                either.sequence(
                  signatures.map(signature =>
                    checkArgumentType(argument, signature.parameter, context),
                  ),
                ),
                _ => undefined,
              ),
            none: _ =>
              either.makeLeft({
                kind: 'invalidExpression',
                message: `only functions can be applied, but got a \`${stringifyTypeForEndUser(functionType)}\``,
              }),
          }),
      )

      return either.flatMap(
        argumentTypeCheck,
        (): Either<ElaborationError, SemanticGraph> => {
          if (containsAnyUnelaboratedNodes(argument)) {
            // The argument isn't ready, so keep the @apply unelaborated.
            return either.makeRight(applyExpression)
          } else if (isFunctionNode(functionToApply)) {
            const result = functionToApply(argument, context)
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
