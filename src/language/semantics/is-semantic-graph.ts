import type { Atom, Molecule } from '../parsing.js'
import { nodeTag } from './semantic-graph-node-tag.js'
import type { SemanticGraph, TypeSymbol } from './semantic-graph.js'

export const isSemanticGraph = (
  value:
    | TypeSymbol
    | Atom
    | Molecule
    | {
        readonly [nodeTag]?: Exclude<
          SemanticGraph,
          Atom | TypeSymbol
        >[typeof nodeTag]
      },
): value is SemanticGraph =>
  typeof value === 'symbol' ||
  typeof value === 'string' ||
  ((typeof value === 'object' || typeof value === 'function') &&
    nodeTag in value &&
    typeof value[nodeTag] === 'string')
