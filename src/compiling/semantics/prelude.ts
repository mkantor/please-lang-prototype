import { either } from '../../adts/index.js'
import {
  isAtomNode,
  makeAtomNode,
  makeFunctionNode,
  makeObjectNode,
  type ObjectNode,
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
      const isBoolean =
        isAtomNode(value) && (value.atom === 'true' || value.atom === 'false')
      return either.makeRight(
        isBoolean ? makeAtomNode('true') : makeAtomNode('false'),
      )
    }),
  }),
})
