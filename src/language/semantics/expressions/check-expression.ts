import { either, type Either } from '../../../adts.js'
import type { ElaborationError } from '../../errors.js'
import type { Molecule } from '../../parsing.js'
import { isExpression, type Expression } from '../expression.js'
import { makeUnelaboratedObjectNode } from '../object-node.js'
import { type SemanticGraph, type unelaboratedKey } from '../semantic-graph.js'
import { readArgumentsFromExpression } from './expression-utilities.js'

export type CheckExpression = Expression & {
  readonly 0: '@check'
  readonly value: SemanticGraph | Molecule
  readonly type: SemanticGraph | Molecule
}

export const readCheckExpression = (
  node: SemanticGraph,
): Either<ElaborationError, CheckExpression> =>
  isExpression(node)
    ? either.map(
        readArgumentsFromExpression(node, [
          ['value', '1'],
          ['type', '2'],
        ]),
        ([value, type]) => makeCheckExpression({ value, type }),
      )
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not an expression',
      })

export const makeCheckExpression = ({
  value,
  type,
}: {
  value: SemanticGraph | Molecule
  type: SemanticGraph | Molecule
}): CheckExpression & { readonly [unelaboratedKey]: true } =>
  makeUnelaboratedObjectNode({
    0: '@check',
    value,
    type,
  })
