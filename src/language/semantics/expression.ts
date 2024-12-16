import type { ObjectNode, SemanticGraph } from '../semantics.js'

export type Expression = ObjectNode & {
  readonly 0: `@${string}`
}

export const isExpression = (node: SemanticGraph): node is Expression =>
  typeof node === 'object' && typeof node[0] === 'string' && node[0][0] === '@'
