import { either, type Either } from '../../../adts.js'
import type { ElaborationError } from '../../errors.js'
import type { Molecule } from '../../parsing.js'
import { isExpression } from '../expression.js'
import { makeUnelaboratedObjectNode, type ObjectNode } from '../object-node.js'
import { type SemanticGraph, type unelaboratedKey } from '../semantic-graph.js'
import { readArgumentsFromExpression } from './expression-utilities.js'

export type ApplyExpression = ObjectNode & {
  readonly 0: '@apply'
  readonly function: SemanticGraph | Molecule
  readonly argument: SemanticGraph | Molecule
}

export const readApplyExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, ApplyExpression> =>
  isExpression(node)
    ? either.map(
        readArgumentsFromExpression(node, [
          ['function', '1'],
          ['argument', '2'],
        ]),
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
}): ApplyExpression & { readonly [unelaboratedKey]: true } =>
  makeUnelaboratedObjectNode({
    0: '@apply',
    function: f,
    argument,
  })
