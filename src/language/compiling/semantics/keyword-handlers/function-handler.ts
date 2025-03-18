import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import {
  asSemanticGraph,
  elaborateWithContext,
  makeFunctionNode,
  makeObjectNode,
  readFunctionExpression,
  serialize,
  types,
  updateValueAtKeyPathInSemanticGraph,
  type Expression,
  type ExpressionContext,
  type FunctionExpression,
  type FunctionNode,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'

export const functionKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, FunctionNode> =>
  either.map(readFunctionExpression(expression), functionExpression =>
    makeFunctionNode(
      {
        // TODO
        parameter: types.something,
        return: types.something,
      },
      () => either.makeRight(functionExpression),
      option.makeSome(functionExpression.parameter),
      argument => apply(functionExpression, argument, context),
    ),
  )

const apply = (
  expression: FunctionExpression,
  argument: SemanticGraph,
  context: ExpressionContext,
): ReturnType<FunctionNode> => {
  const parameter = expression.parameter
  const body = asSemanticGraph(expression.body)

  const ownKey = context.location[context.location.length - 1]
  if (ownKey === undefined) {
    return either.makeLeft({
      kind: 'panic',
      message: 'function had no location',
    })
  }

  // TODO: Make this foolproof.
  const returnKey =
    parameter === 'return' || ownKey === 'return'
      ? 'return with a different key to avoid collision with a stupidly-named parameter'
      : 'return'

  const result = either.flatMap(serialize(body), serializedBody =>
    either.flatMap(
      updateValueAtKeyPathInSemanticGraph(
        context.program,
        context.location,
        _ =>
          makeObjectNode({
            // Include the function itself to allow recursion.
            [ownKey]: makeFunctionNode(
              {
                // TODO
                parameter: types.something,
                return: types.something,
              },
              () => either.makeRight(expression),
              option.makeSome(parameter),
              argument => apply(expression, argument, context),
            ),
            // Put the argument in scope.
            [expression.parameter]: argument,
            [returnKey]: body,
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

  if (either.isLeft(result)) {
    return either.makeLeft({
      kind: 'panic',
      message: result.value.message,
    })
  } else {
    return result
  }
}
