import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Atom } from '../../parsing.js'
import { isKeywordExpressionWithArgument } from '../expression.js'
import {
  isObjectNode,
  makeObjectNode,
  type ObjectNode,
} from '../object-node.js'
import { serialize, type SemanticGraph } from '../semantic-graph.js'
import {
  asSemanticGraph,
  readArgumentsFromExpression,
} from './expression-utilities.js'

export type FunctionExpression = ObjectNode & {
  readonly 0: '@function'
  readonly 1: {
    readonly parameter: Atom | ObjectNode
    readonly body: SemanticGraph
  }
}

export const readFunctionExpression = (
  node: SemanticGraph,
): Either<ElaborationError, FunctionExpression> =>
  isKeywordExpressionWithArgument('@function', node) ?
    either.flatMap(
      readArgumentsFromExpression(node, ['parameter', 'body']),
      ([parameter, body]): Either<ElaborationError, FunctionExpression> =>
        typeof parameter !== 'string' && !isObjectNode(parameter) ?
          either.makeLeft({
            kind: 'invalidExpression',
            message: 'parameter must be an atom or an object',
          })
        : isObjectNode(parameter) && Object.keys(parameter).length !== 1 ?
          either.makeLeft({
            kind: 'invalidExpression',
            message: 'typed parameter object must contain exactly one property',
          })
        : either.map(serialize(body), body =>
            makeFunctionExpression(parameter, asSemanticGraph(body)),
          ),
    )
  : either.makeLeft({
      kind: 'invalidExpression',
      message: 'not a `@function` expression',
    })

export const makeFunctionExpression = (
  parameter: Atom | ObjectNode,
  body: SemanticGraph,
): FunctionExpression =>
  makeObjectNode({
    0: '@function',
    1: makeObjectNode({
      parameter,
      body,
    }),
  })

export const getParameterName = (expression: FunctionExpression): Atom => {
  if (typeof expression[1].parameter === 'string') {
    return expression[1].parameter
  } else {
    const parameterName = Object.keys(expression[1].parameter)[0]
    if (parameterName === undefined) {
      throw new Error(
        '@function parameter object did not contain any properties. This is a bug!',
      )
    }
    return parameterName
  }
}
