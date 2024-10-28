import * as either from '../../adts/either.js'
import {
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
})
