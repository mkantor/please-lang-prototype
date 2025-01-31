import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Atom, Molecule } from '../../parsing.js'
import { isSpecificExpression } from '../expression.js'
import { makeUnelaboratedObjectNode, type ObjectNode } from '../object-node.js'
import {
  serialize,
  type SemanticGraph,
  type unelaboratedKey,
} from '../semantic-graph.js'
import {
  asSemanticGraph,
  readArgumentsFromExpression,
} from './expression-utilities.js'

export type FunctionExpression = ObjectNode & {
  readonly 0: '@function'
  readonly parameter: Atom
  readonly body: SemanticGraph | Molecule
}

export const readFunctionExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, FunctionExpression> =>
  isSpecificExpression('@function', node)
    ? either.flatMap(
        readArgumentsFromExpression(node, [
          ['parameter', '1'],
          ['body', '2'],
        ]),
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
): FunctionExpression & { readonly [unelaboratedKey]: true } =>
  makeUnelaboratedObjectNode({
    0: '@function',
    parameter,
    body,
  })
