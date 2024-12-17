import { either, option, type Either } from '../../../../adts.js'
import type { ElaborationError } from '../../../errors.js'
import {
  asSemanticGraph,
  makeFunctionNode,
  readFunctionExpression,
  serialize,
  types,
  type Expression,
  type FunctionExpression,
  type FunctionNode,
} from '../../../semantics.js'
import {
  elaborateWithContext,
  type ExpressionContext,
  type KeywordHandler,
} from '../../../semantics/expression-elaboration.js'
import { makeObjectNode } from '../../../semantics/object-node.js'
import {
  updateValueAtKeyPathInSemanticGraph,
  type SemanticGraph,
} from '../../../semantics/semantic-graph.js'
import { keywordHandlers } from '../keywords.js'

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

  // TODO: Make this foolproof.
  const returnKey =
    parameter === 'return'
      ? 'return with a different key to avoid collision with a stupidly-named parameter'
      : 'return'

  const result = either.flatMap(serialize(body), serializedBody =>
    either.flatMap(
      updateValueAtKeyPathInSemanticGraph(
        context.program,
        context.location,
        _ =>
          makeObjectNode({
            // Put the argument in scope.
            [expression.parameter]: argument,
            [returnKey]: body,
          }),
      ),
      updatedProgram =>
        elaborateWithContext(
          serializedBody,
          // TODO: This should use compile-time or runtime handlers when appropriate. Perhaps
          // keyword handlers should be part of `ExpressionContext`?
          keywordHandlers,
          {
            location: [...context.location, returnKey],
            program: updatedProgram,
          },
        ),
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
