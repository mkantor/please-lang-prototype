import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Atom, Molecule } from '../../parsing.js'
import { isKeywordExpressionWithArgument } from '../expression.js'
import { makeObjectNode, type ObjectNode } from '../object-node.js'
import { serialize, type SemanticGraph } from '../semantic-graph.js'
import {
  asSemanticGraph,
  readArgumentsFromExpression,
} from './expression-utilities.js'

export type FunctionExpression = ObjectNode & {
  readonly 0: '@function'
  readonly 1: {
    readonly parameter: Atom
    readonly body: SemanticGraph | Molecule
  }
}

export const readFunctionExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, FunctionExpression> =>
  isKeywordExpressionWithArgument('@function', node)
    ? either.flatMap(
        readArgumentsFromExpression(node, ['parameter', 'body']),
        ([parameter, body]): Either<ElaborationError, FunctionExpression> =>
          typeof parameter !== 'string'
            ? either.makeLeft({
                kind: 'invalidExpression',
                message: 'parameter name must be an atom',
              })
            : either.map(serialize(asSemanticGraph(body)), body =>
                makeFunctionExpression(parameter, body),
              ),
      )
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not an expression',
      })

export const makeFunctionExpression = (
  parameter: Atom,
  body: SemanticGraph | Molecule,
): FunctionExpression =>
  makeObjectNode({
    0: '@function',
    1: makeObjectNode({
      parameter,
      body,
    }),
  })
