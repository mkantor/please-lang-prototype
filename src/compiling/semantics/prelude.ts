import { either } from '../../adts.js'
import {
  isAtomNode,
  isFunctionNode,
  isObjectNode,
  makeAtomNode,
  makeFunctionNode,
  makeObjectNode,
  types,
  type AtomNode,
  type ObjectNode,
  type SemanticGraph,
} from '../../semantics.js'
import {
  makeFunctionType,
  makeObjectType,
  makeTypeParameter,
} from '../../semantics/type-system/type-formats.js'

const A = makeTypeParameter('a', { assignableTo: types.something })
const B = makeTypeParameter('b', { assignableTo: types.something })
const C = makeTypeParameter('c', { assignableTo: types.something })

export const prelude: ObjectNode = makeObjectNode({
  apply: makeFunctionNode(
    {
      // a => ((a => b) => b)
      parameter: A,
      return: makeFunctionType('', {
        parameter: makeFunctionType('', { parameter: A, return: B }),
        return: B,
      }),
    },
    a =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.functionType,
            return: types.something,
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

  // { 0: a => b, 1: b => c } => (a => c)
  flow: makeFunctionNode(
    {
      parameter: makeObjectType('', {
        0: makeFunctionType('', {
          parameter: A,
          return: B,
        }),
        1: makeFunctionType('', {
          parameter: B,
          return: C,
        }),
      }),
      return: makeFunctionType('', {
        parameter: A,
        return: C,
      }),
    },
    value => {
      if (!isObjectNode(value)) {
        return either.makeLeft({
          kind: 'panic',
          message: '`flow` must be given an object',
        })
      } else if (
        value.children['0'] === undefined ||
        value.children['1'] === undefined
      ) {
        return either.makeLeft({
          kind: 'panic',
          message:
            "`flow`'s argument must contain properties named '0' and '1'",
        })
      } else if (
        !isFunctionNode(value.children['0']) ||
        !isFunctionNode(value.children['1'])
      ) {
        return either.makeLeft({
          kind: 'panic',
          message: "`flow`'s argument must contain functions",
        })
      } else {
        const function0 = value.children['0']
        const function1 = value.children['1']
        return either.makeRight(
          makeFunctionNode(
            {
              parameter: function0.signature.signature.parameter,
              return: function1.signature.signature.parameter,
            },
            value =>
              either.flatMap(function0.function(value), function1.function),
          ),
        )
      }
    },
  ),

  identity: makeFunctionNode({ parameter: A, return: A }, either.makeRight),

  boolean: makeObjectNode({
    true: makeAtomNode('true'),
    false: makeAtomNode('false'),
    is: makeFunctionNode(
      {
        parameter: types.something,
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
      parameter: types.something,
      return: types.something,
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
              parameter: types.something,
              return: types.something,
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
        return: types.something,
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
                parameter: types.something,
                return: types.something,
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
