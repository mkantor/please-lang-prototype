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
  compose: makeFunctionNode(value => {
    if (!isObjectNode(value)) {
      return either.makeLeft({
        kind: 'panic',
        message: '`compose` must be given an object',
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
                message: '`compose` may only be passed functions',
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
            functionNodes.reduceRight(
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
})

const nodeIsBoolean = (
  node: SemanticGraph,
): node is AtomNode & { readonly atom: 'true' | 'false' } =>
  isAtomNode(node) && (node.atom === 'true' || node.atom === 'false')
