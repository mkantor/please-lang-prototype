import { either, type Either } from '../../adts.js'
import type { Panic } from '../../errors.js'
import {
  isAtomNode,
  isFunctionNode,
  isObjectNode,
  makeAtomNode,
  makeFunctionNode,
  makeObjectNode,
  type AtomNode,
  type FunctionNode,
  type ObjectNode,
  type SemanticGraph,
} from '../../semantics.js'

export const prelude: ObjectNode = makeObjectNode({
  flow: makeFunctionNode(value => {
    if (!isObjectNode(value)) {
      return either.makeLeft({
        kind: 'panic',
        message: '`flow` must be given an object',
      })
    } else {
      const functionNodesResult: Either<Panic, readonly FunctionNode[]> =
        (() => {
          const functionNodes: FunctionNode[] = []
          let index = 0
          // Consume numeric indexes ("0", "1", …) until exhausted, validating each.
          let node = value.children[index]
          while (node !== undefined) {
            if (!isFunctionNode(node)) {
              return either.makeLeft({
                kind: 'panic',
                message: '`flow` may only be passed functions',
              })
            } else {
              functionNodes.push(node)
            }
            index++
            node = value.children[index]
          }
          return either.makeRight(functionNodes)
        })()

      return either.map(functionNodesResult, functionNodes =>
        makeFunctionNode(
          (initialValue: SemanticGraph): Either<Panic, SemanticGraph> =>
            functionNodes.reduce(
              (value: Either<Panic, SemanticGraph>, node) =>
                either.flatMap(value, node.function),
              either.makeRight(initialValue),
            ),
        ),
      )
    }
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

  match: makeFunctionNode(cases => {
    if (!isObjectNode(cases)) {
      return either.makeLeft({
        kind: 'panic',
        message: 'match cases must be an object',
      })
    } else {
      return either.makeRight(
        makeFunctionNode(value => {
          if (!nodeIsTagged(value)) {
            return either.makeLeft({
              kind: 'panic',
              message: 'value was not tagged',
            })
          } else {
            const relevantCase = cases.children[value.children.tag.atom]
            if (relevantCase === undefined) {
              return either.makeLeft({
                kind: 'panic',
                message: `case for tag '${value.children.tag.atom}' was not defined`,
              })
            } else {
              return !isFunctionNode(relevantCase)
                ? either.makeRight(relevantCase)
                : relevantCase.function(value.children.value)
            }
          }
        }),
      )
    }
  }),

  object: makeObjectNode({
    get: makeFunctionNode(key => {
      if (!isAtomNode(key)) {
        return either.makeLeft({
          kind: 'panic',
          message: 'key was not an atom',
        })
      } else {
        return either.makeRight(
          makeFunctionNode(value => {
            if (!isObjectNode(value)) {
              return either.makeLeft({
                kind: 'panic',
                message: 'value was not an object',
              })
            } else {
              const propertyValue = value.children[key.atom]
              if (propertyValue === undefined) {
                return either.makeRight(
                  makeObjectNode({
                    tag: makeAtomNode('none'),
                    value: makeObjectNode({}),
                  }),
                )
              } else {
                return either.makeRight(
                  makeObjectNode({
                    tag: makeAtomNode('some'),
                    value: propertyValue,
                  }),
                )
              }
            }
          }),
        )
      }
    }),
  }),
})

type BooleanNode = AtomNode & { readonly atom: 'true' | 'false' }
const nodeIsBoolean = (node: SemanticGraph): node is BooleanNode =>
  isAtomNode(node) && (node.atom === 'true' || node.atom === 'false')

type TaggedNode = ObjectNode & {
  readonly children: {
    readonly tag: AtomNode
    readonly value: SemanticGraph
  }
}
const nodeIsTagged = (node: SemanticGraph): node is TaggedNode =>
  isObjectNode(node) &&
  node.children.tag !== undefined &&
  isAtomNode(node.children.tag) &&
  node.children.value !== undefined
