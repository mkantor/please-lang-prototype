import type { ObjectNode } from './object-node.js'
import type { SemanticGraph } from './semantic-graph.js'

export type Expression = ObjectNode & {
  readonly 0: `@${string}`
  readonly 1?: SemanticGraph
}

export const isExpression = (node: SemanticGraph): node is Expression =>
  typeof node === 'object' &&
  typeof node[0] === 'string' &&
  /^@[^@]/.test(node['0']) &&
  (!('1' in node) ||
    typeof node[1] === 'object' ||
    typeof node[1] === 'string' ||
    typeof node[1] === 'symbol')

export const isKeywordExpressionWithArgument = <Keyword extends `@${string}`>(
  keyword: Keyword,
  node: SemanticGraph,
): node is Expression & {
  readonly 0: Keyword
  readonly 1: SemanticGraph
} =>
  typeof node === 'object' &&
  typeof node[0] === 'string' &&
  node[0] === keyword &&
  (typeof node[1] === 'object' ||
    typeof node[1] === 'string' ||
    typeof node[1] === 'symbol')
