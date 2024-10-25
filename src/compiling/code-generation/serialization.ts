import type { JSONValue } from '../../utility-types.js'
import {
  semanticGraphToSyntaxTree,
  type SemanticGraph,
} from '../semantics/semantic-graph.js'

export const serialize: (node: SemanticGraph) => JSONValue =
  semanticGraphToSyntaxTree
