import { withPhantomData, type WithPhantomData } from '../../phantom-data.js'
import type { Writable } from '../../utility-types.js'
import type { SyntaxTree } from '../compiler.js'
import type { Atom } from '../parsing/atom.js'
import type { Molecule } from '../parsing/molecule.js'
import type { Canonicalized } from '../stages.js'

const nodeTag = Symbol('nodeTag')

export type AtomNode = {
  readonly [nodeTag]: 'atom'
  readonly atom: Atom
}
export const isAtomNode = (node: SemanticGraph) => node[nodeTag] === 'atom'
export const makeAtomNode = (atom: Atom): AtomNode => ({
  [nodeTag]: 'atom',
  atom,
})

export type ObjectNode = {
  readonly [nodeTag]: 'object'
  readonly children: Readonly<Record<Atom, SemanticGraph>>
}
export const isObjectNode = (node: SemanticGraph) => node[nodeTag] === 'object'
export const makeObjectNode = (
  children: Readonly<Record<Atom, SemanticGraph>>,
): ObjectNode => ({ [nodeTag]: 'object', children })

export type SemanticGraph = AtomNode | ObjectNode

export const literalValueToSemanticGraph = (
  value: Atom | Molecule,
): SemanticGraph =>
  typeof value === 'string'
    ? makeAtomNode(value)
    : literalMoleculeToObjectNode(value)

export const literalMoleculeToObjectNode = (molecule: Molecule): ObjectNode => {
  const children: Writable<ObjectNode['children']> = {}
  for (const [key, propertyValue] of Object.entries(molecule)) {
    children[key] = literalValueToSemanticGraph(propertyValue)
  }
  return { [nodeTag]: 'object', children }
}

export const semanticGraphToSyntaxTree = (node: SemanticGraph): SyntaxTree =>
  node[nodeTag] === 'atom'
    ? withPhantomData<Canonicalized>()(node.atom)
    : objectNodeToMolecule(node)

const objectNodeToMolecule = (
  node: ObjectNode,
): WithPhantomData<Molecule, Canonicalized> => {
  const molecule: Writable<Molecule> = {}
  for (const [key, propertyValue] of Object.entries(node.children)) {
    molecule[key] = semanticGraphToSyntaxTree(propertyValue)
  }
  return withPhantomData<Canonicalized>()(molecule)
}
