import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import {
  elaborateWithContext,
  getParameterName,
  getParameterTypeAnnotation,
  ignoredKey,
  inferType,
  makeFunctionNode,
  makeObjectNode,
  readFunctionExpression,
  serialize,
  updateValueAtKeyPathInSemanticGraph,
  type Expression,
  type ExpressionContext,
  type FunctionExpression,
  type FunctionNode,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'
import { collectHolesByName } from '../../../semantics/expressions/hole-expression.js'

export const functionKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, FunctionNode> =>
  either.flatMap(readFunctionExpression(expression), functionExpression =>
    either.flatMap(inferType(expression, context), inferredType => {
      if (inferredType.kind !== 'function') {
        return either.makeLeft({
          kind: 'bug',
          message:
            'inferred type of function expression was not a function type',
        })
      } else {
        return either.makeRight(
          makeFunctionNode(
            inferredType.signature,
            () => either.makeRight(functionExpression),
            option.makeSome(getParameterName(functionExpression)),
            argument =>
              apply(
                functionExpression,
                inferredType.signature,
                argument,
                context,
              ),
          ),
        )
      }
    }),
  )

const apply = (
  expression: FunctionExpression,
  signature: FunctionNode['signature'],
  argument: SemanticGraph,
  context: ExpressionContext,
): ReturnType<FunctionNode> => {
  const parameterName = getParameterName(expression)
  const body = expression[1].body

  const ownKey = context.location[context.location.length - 1]
  if (ownKey === undefined) {
    return either.makeLeft({
      kind: 'panic',
      message: 'function had no location',
    })
  }

  // TODO: Make this foolproof.
  const returnKey =
    parameterName === 'return' || ownKey === 'return' ?
      'return with a different key to avoid collision with a stupidly-named parameter'
    : 'return'

  const holeBindings: Record<string, SemanticGraph> = option.match(
    getParameterTypeAnnotation(expression),
    {
      none: _ => ({}),
      some: annotation => {
        const holeBindings: Record<string, SemanticGraph> = {}
        for (const [name, hole] of collectHolesByName(annotation)) {
          if (
            name !== parameterName &&
            name !== ownKey &&
            name !== returnKey &&
            name !== ignoredKey
          ) {
            holeBindings[name] = hole
          }
        }
        return holeBindings
      },
    },
  )

  const result = either.flatMap(serialize(body), serializedBody =>
    either.flatMap(
      updateValueAtKeyPathInSemanticGraph(
        context.program,
        context.location,
        _ =>
          makeObjectNode({
            // Include the function itself to allow recursion.
            [ownKey]: makeFunctionNode(
              signature,
              () => either.makeRight(expression),
              option.makeSome(parameterName),
              argument => apply(expression, signature, argument, context),
            ),
            // Put the argument in scope.
            [parameterName]: argument,
            // Put any `@hole`s from the parameter annotation in scope so type
            // parameters can be referenced.
            ...holeBindings,
            // Use the serialized form so the body in the program matches what
            // gets re-elaborated.
            [returnKey]: serializedBody,
          }),
      ),
      updatedProgram =>
        elaborateWithContext(serializedBody, {
          keywordHandlers: context.keywordHandlers,
          location: [...context.location, returnKey],
          program: updatedProgram,
        }),
    ),
  )

  return either.mapLeft(result, error => ({
    kind: 'panic',
    message: error.message,
  }))
}
