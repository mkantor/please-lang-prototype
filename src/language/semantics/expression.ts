import type { Molecule } from '../parsing.js'
import type { SemanticGraph } from './semantic-graph.js'

export type Expression = {
  readonly 0: `@${string}`
}

export const isExpression = (
  node: SemanticGraph | Molecule,
): node is Expression =>
  typeof node === 'object' && typeof node[0] === 'string' && node[0][0] === '@'
