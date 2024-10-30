import { withPhantomData, type WithPhantomData } from '../../phantom-data.js'
import {
  isAtomNode,
  isObjectNode,
  type AtomNode,
  type FunctionNode,
  type ObjectNode,
  type SemanticGraph,
} from '../../semantics.js'
import type { Writable } from '../../utility-types.js'
import type { Atom } from '../parsing/atom.js'
import type { Molecule } from '../parsing/molecule.js'
import type { SyntaxTree } from '../parsing/syntax-tree.js'
import type { Canonicalized } from '../stages.js'

export const serialize = (node: SemanticGraph): SyntaxTree =>
  isAtomNode(node)
    ? serializeAtomNode(node)
    : isObjectNode(node)
    ? serializeObjectNode(node)
    : serializeFunctionNode(node)

const serializeAtomNode = (
  node: AtomNode,
): WithPhantomData<Atom, Canonicalized> =>
  withPhantomData<Canonicalized>()(node.atom)

const serializeFunctionNode = (
  _node: FunctionNode,
): WithPhantomData<Molecule, Canonicalized> =>
  withPhantomData<Canonicalized>()({
    // TODO: model (runtime) functions in code generation
  })

const serializeObjectNode = (
  node: ObjectNode,
): WithPhantomData<Molecule, Canonicalized> => {
  const molecule: Writable<Molecule> = {}
  for (const [key, propertyValue] of Object.entries(node.children)) {
    molecule[key] = serialize(propertyValue)
  }
  return withPhantomData<Canonicalized>()(molecule)
}
