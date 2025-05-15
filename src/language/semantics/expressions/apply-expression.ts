import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Molecule } from '../../parsing.js'
import { isExpressionWithArgument } from '../expression.js'
import { makeObjectNode, type ObjectNode } from '../object-node.js'
import { type SemanticGraph } from '../semantic-graph.js'
import { readArgumentsFromExpression } from './expression-utilities.js'

export type ApplyExpression = ObjectNode & {
  readonly 0: '@apply'
  readonly 1: {
    readonly function: SemanticGraph | Molecule
    readonly argument: SemanticGraph | Molecule
  }
}

export const readApplyExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, ApplyExpression> =>
  isExpressionWithArgument('@apply', node)
    ? either.map(
        readArgumentsFromExpression(node, ['function', 'argument']),
        ([f, argument]) => makeApplyExpression({ function: f, argument }),
      )
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not an expression',
      })

export const makeApplyExpression = ({
  function: f,
  argument,
}: {
  readonly function: SemanticGraph | Molecule
  readonly argument: SemanticGraph | Molecule
}): ApplyExpression =>
  makeObjectNode({
    0: '@apply',
    1: makeObjectNode({
      function: f,
      argument,
    }),
  })
