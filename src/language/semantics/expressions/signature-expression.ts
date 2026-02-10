import type { ObjectNode } from '../object-node.js'
import type { SemanticGraph } from '../semantic-graph.js'

export type SignatureExpression = ObjectNode & {
  readonly 0: '@signature'
  readonly 1: {
    readonly parameter: SemanticGraph
    readonly return: SemanticGraph
  }
}
