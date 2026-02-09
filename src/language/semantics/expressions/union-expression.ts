import type { ObjectNode } from '../object-node.js'

export type UnionExpression = ObjectNode & {
  readonly 0: '@union'
  /**
   * Property values in this object are interpreted as types which form the
   * members of the union.
   */
  readonly 1: ObjectNode
}
