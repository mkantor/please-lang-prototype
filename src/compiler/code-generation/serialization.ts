import type { JSONValue } from '../../utility-types.js'
import {
  semanticNodeToMoleculeOrAtom,
  type SemanticNode,
} from '../semantics/keywords.js'

export const serialize: (node: SemanticNode) => JSONValue =
  semanticNodeToMoleculeOrAtom
