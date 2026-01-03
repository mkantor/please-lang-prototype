import type { Atom, Molecule } from '../parsing.js'
import type { SemanticGraph } from './semantic-graph.js'

export type Expression = {
  readonly 0: `@${string}`
  readonly 1?: Atom | Molecule
}

export const isExpression = (
  node: SemanticGraph | Molecule,
): node is Expression =>
  typeof node === 'object' &&
  typeof node[0] === 'string' &&
  /^@[^@]/.test(node['0']) &&
  (!('1' in node) ||
    typeof node[1] === 'object' ||
    typeof node[1] === 'string' ||
    typeof node[1] === 'symbol')

export const isKeywordExpressionWithArgument = <Keyword extends `@${string}`>(
  keyword: Keyword,
  node: Molecule | SemanticGraph,
): node is {
  readonly 0: Keyword
  readonly 1: Molecule
} =>
  typeof node === 'object' &&
  typeof node[0] === 'string' &&
  node[0] === keyword &&
  (typeof node[1] === 'object' ||
    typeof node[1] === 'string' ||
    typeof node[1] === 'symbol')
