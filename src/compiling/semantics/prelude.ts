import { either } from '../../adts/index.js'
import {
  isAtomNode,
  makeAtomNode,
  makeFunctionNode,
  makeObjectNode,
  type AtomNode,
  type ObjectNode,
  type SemanticGraph,
} from './semantic-graph.js'

export const prelude: ObjectNode = makeObjectNode({
  language: makeObjectNode({
    version: makeObjectNode({
      major: makeAtomNode('0'),
      minor: makeAtomNode('0'),
      patch: makeAtomNode('0'),
    }),
  }),

  identity: makeFunctionNode(either.makeRight),

  boolean: makeObjectNode({
    is: makeFunctionNode(value => {
      return either.makeRight(
        nodeIsBoolean(value) ? makeAtomNode('true') : makeAtomNode('false'),
      )
    }),
    not: makeFunctionNode(value => {
      if (!nodeIsBoolean(value)) {
        return either.makeLeft({
          kind: 'panic',
          message: 'value was not a boolean',
        })
      } else {
        return either.makeRight(
          value.atom === 'true' ? makeAtomNode('false') : makeAtomNode('true'),
        )
      }
    }),
  }),
})

const nodeIsBoolean = (
  node: SemanticGraph,
): node is AtomNode & { readonly atom: 'true' | 'false' } =>
  isAtomNode(node) && (node.atom === 'true' || node.atom === 'false')
