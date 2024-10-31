import type { Atom, Molecule } from '../../parsing.js'
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

declare const _generated: unique symbol
type Generated = { readonly [_generated]: true }
export type Code = WithPhantomData<Atom | Molecule, Generated>

export const serialize = (node: SemanticGraph): Code =>
  isAtomNode(node)
    ? serializeAtomNode(node)
    : isObjectNode(node)
    ? serializeObjectNode(node)
    : serializeFunctionNode(node)

const serializeAtomNode = (node: AtomNode): WithPhantomData<Atom, Generated> =>
  withPhantomData<Generated>()(node.atom)

const serializeFunctionNode = (
  _node: FunctionNode,
): WithPhantomData<Molecule, Generated> =>
  withPhantomData<Generated>()({
    // TODO: model (runtime) functions in code generation
  })

const serializeObjectNode = (
  node: ObjectNode,
): WithPhantomData<Molecule, Generated> => {
  const molecule: Writable<Molecule> = {}
  for (const [key, propertyValue] of Object.entries(node.children)) {
    molecule[key] = serialize(propertyValue)
  }
  return withPhantomData<Generated>()(molecule)
}
