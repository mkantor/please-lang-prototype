import type { Molecule } from '../parsing.js'
import type { SemanticGraph } from './semantic-graph.js'

export type Expression = {
  readonly 0: `@${string}`
}

export const isExpression = (
  node: SemanticGraph | Molecule,
): node is Expression =>
  typeof node === 'object' && typeof node[0] === 'string' && node[0][0] === '@'

export const isSpecificExpression = <Keyword extends `@${string}`>(
  keyword: Keyword,
  node: SemanticGraph | Molecule,
): node is {
  readonly 0: Keyword
} =>
  typeof node === 'object' && typeof node[0] === 'string' && node[0] === keyword
