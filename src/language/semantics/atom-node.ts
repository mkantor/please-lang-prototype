import { either, type Either } from '../../adts.js'
import type { Atom } from '../parsing.js'
import { nodeTag, type SemanticGraph } from './semantic-graph.js'

export type AtomNode = {
  readonly [nodeTag]: 'atom'
  readonly atom: Atom
}

export const isAtomNode = (node: SemanticGraph) => node[nodeTag] === 'atom'

export const makeAtomNode = <SpecificAtom extends Atom>(
  atom: SpecificAtom,
): AtomNode & { readonly atom: SpecificAtom } => ({
  [nodeTag]: 'atom',
  atom,
})

export const serializeAtomNode = (node: AtomNode): Either<never, Atom> =>
  either.makeRight(node.atom)
