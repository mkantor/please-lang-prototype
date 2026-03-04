import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import { isKeywordExpressionWithArgument } from '../expression.js'
import type { ObjectNode } from '../object-node.js'
import { isObjectNode, makeObjectNode } from '../object-node.js'
import type { SemanticGraph } from '../semantic-graph.js'

export type UnionExpression = ObjectNode & {
  readonly 0: '@union'
  /**
   * Property values in this object are interpreted as types which form the
   * members of the union.
   */
  readonly 1: ObjectNode
}

export const readUnionExpression = (
  node: SemanticGraph,
): Either<ElaborationError, UnionExpression> =>
  isKeywordExpressionWithArgument('@union', node) && isObjectNode(node['1']) ?
    either.makeRight(makeUnionExpression(node['1']))
  : either.makeLeft({
      kind: 'invalidExpression',
      message: 'not a `@union` expression',
    })

export const makeUnionExpression = (members: ObjectNode): UnionExpression =>
  makeObjectNode({
    0: '@union',
    1: members,
  })
