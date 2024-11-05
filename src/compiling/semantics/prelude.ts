import { either, type Either } from '../../adts.js'
import type { Panic } from '../../errors.js'
import {
  isAtomNode,
  isFunctionNode,
  isObjectNode,
  makeAtomNode,
  makeFunctionNode,
  makeObjectNode,
  types,
  type AtomNode,
  type FunctionNode,
  type ObjectNode,
  type SemanticGraph,
} from '../../semantics.js'

export const prelude: ObjectNode = makeObjectNode({
  // TODO: model this and other type signatures generically (e.g. `apply` is `a => (a => b) => b`)
  apply: makeFunctionNode(
    {
      parameter: types.value,
      return: types.functionType,
    },
    a =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.functionType,
            return: types.value,
          },
          f => {
            if (!isFunctionNode(f)) {
              return either.makeLeft({
                kind: 'panic',
                message: 'expected a function',
              })
            } else {
              return f.function(a)
            }
          },
        ),
      ),
  ),

  flow: makeFunctionNode(
    {
      // TODO
      parameter: types.value,
      return: types.value,
    },
    value => {
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
            {
              // TODO
              parameter: types.value,
              return: types.value,
            },
            (initialValue: SemanticGraph): Either<Panic, SemanticGraph> =>
              functionNodes.reduce(
                (value: Either<Panic, SemanticGraph>, node) =>
                  either.flatMap(value, node.function),
                either.makeRight(initialValue),
              ),
          ),
        )
      }
    },
  ),

  identity: makeFunctionNode(
    {
      // TODO
      parameter: types.value,
      return: types.value,
    },
    either.makeRight,
  ),

  boolean: makeObjectNode({
    true: makeAtomNode('true'),
    false: makeAtomNode('false'),
    is: makeFunctionNode(
      {
        parameter: types.value,
        return: types.boolean,
      },
      value =>
        either.makeRight(
          nodeIsBoolean(value) ? makeAtomNode('true') : makeAtomNode('false'),
        ),
    ),
    not: makeFunctionNode(
      {
        parameter: types.boolean,
        return: types.boolean,
      },
      value => {
        if (!nodeIsBoolean(value)) {
          return either.makeLeft({
            kind: 'panic',
            message: 'value was not a boolean',
          })
        } else {
          return either.makeRight(
            value.atom === 'true'
              ? makeAtomNode('false')
              : makeAtomNode('true'),
          )
        }
      },
    ),
  }),

  match: makeFunctionNode(
    {
      // TODO
      parameter: types.value,
      return: types.value,
    },
    cases => {
      if (!isObjectNode(cases)) {
        return either.makeLeft({
          kind: 'panic',
          message: 'match cases must be an object',
        })
      } else {
        return either.makeRight(
          makeFunctionNode(
            {
              // TODO
              parameter: types.value,
              return: types.value,
            },
            value => {
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
            },
          ),
        )
      }
    },
  ),

  object: makeObjectNode({
    lookup: makeFunctionNode(
      {
        // TODO
        parameter: types.string,
        return: types.value,
      },
      key => {
        if (!isAtomNode(key)) {
          return either.makeLeft({
            kind: 'panic',
            message: 'key was not an atom',
          })
        } else {
          return either.makeRight(
            makeFunctionNode(
              {
                // TODO
                parameter: types.value,
                return: types.value,
              },
              value => {
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
              },
            ),
          )
        }
      },
    ),
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
