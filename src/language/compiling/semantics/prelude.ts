import { either, type Either } from '../../../adts.js'
import type { Panic } from '../../errors.js'
import {
  isAtomNode,
  isFunctionNode,
  isObjectNode,
  isPartiallyElaboratedObjectNode,
  makeAtomNode,
  makeFunctionNode,
  makeObjectNode,
  types,
  type AtomNode,
  type FullyElaboratedSemanticGraph,
  type ObjectNode,
} from '../../semantics.js'
import { serializeObjectNode } from '../../semantics/object-node.js'
import {
  isPartiallyElaboratedSemanticGraph,
  serialize,
  type PartiallyElaboratedSemanticGraph,
} from '../../semantics/semantic-graph.js'
import {
  makeFunctionType,
  makeObjectType,
  makeTypeParameter,
  type FunctionType,
} from '../../semantics/type-system/type-formats.js'

const preludeFunction = (
  keyPath: readonly string[],
  signature: FunctionType['signature'],
  f: (
    value: FullyElaboratedSemanticGraph,
  ) => Either<Panic, FullyElaboratedSemanticGraph>,
) =>
  makeFunctionNode(
    signature,
    () =>
      either.makeRight({
        0: '@lookup',
        1: Object.fromEntries(keyPath.map((key, index) => [index, key])),
      }),
    f,
  )

const A = makeTypeParameter('a', { assignableTo: types.something })
const B = makeTypeParameter('b', { assignableTo: types.something })
const C = makeTypeParameter('c', { assignableTo: types.something })

export const prelude: ObjectNode = makeObjectNode({
  apply: preludeFunction(
    ['apply'],
    {
      // a => ((a => b) => b)
      parameter: A,
      return: makeFunctionType('', {
        parameter: makeFunctionType('', { parameter: A, return: B }),
        return: B,
      }),
    },
    argument =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.functionType,
            return: types.something,
          },
          () =>
            either.map(serialize(argument), serializedArgument => ({
              0: '@apply',
              1: { 0: '@lookup', 1: { 0: 'apply' } },
              2: serializedArgument,
            })),
          functionToApply => {
            if (!isFunctionNode(functionToApply)) {
              return either.makeLeft({
                kind: 'panic',
                message: 'expected a function',
              })
            } else {
              return functionToApply.function(argument)
            }
          },
        ),
      ),
  ),

  // { 0: a => b, 1: b => c } => (a => c)
  flow: preludeFunction(
    ['flow'],
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
    argument => {
      if (!isObjectNode(argument)) {
        return either.makeLeft({
          kind: 'panic',
          message: '`flow` must be given an object',
        })
      } else if (
        argument.children['0'] === undefined ||
        argument.children['1'] === undefined
      ) {
        return either.makeLeft({
          kind: 'panic',
          message:
            "`flow`'s argument must contain properties named '0' and '1'",
        })
      } else if (
        !isFunctionNode(argument.children['0']) ||
        !isFunctionNode(argument.children['1'])
      ) {
        return either.makeLeft({
          kind: 'panic',
          message: "`flow`'s argument must contain functions",
        })
      } else {
        const function0 = argument.children['0']
        const function1 = argument.children['1']
        return either.makeRight(
          makeFunctionNode(
            {
              parameter: function0.signature.signature.parameter,
              return: function1.signature.signature.parameter,
            },
            () =>
              either.flatMap(function0.serialize(), serializedFunction0 =>
                either.map(function1.serialize(), serializedFunction1 => ({
                  0: '@apply',
                  1: { 0: '@lookup', 1: { 0: 'flow' } },
                  2: {
                    0: serializedFunction0,
                    1: serializedFunction1,
                  },
                })),
              ),
            argument =>
              either.flatMap(function0.function(argument), function1.function),
          ),
        )
      }
    },
  ),

  identity: preludeFunction(
    ['identity'],
    { parameter: A, return: A },
    either.makeRight,
  ),

  boolean: makeObjectNode({
    true: makeAtomNode('true'),
    false: makeAtomNode('false'),
    is: preludeFunction(
      ['boolean', 'is'],
      {
        parameter: types.something,
        return: types.boolean,
      },
      argument =>
        either.makeRight(
          nodeIsBoolean(argument)
            ? makeAtomNode('true')
            : makeAtomNode('false'),
        ),
    ),
    not: preludeFunction(
      ['boolean', 'not'],
      {
        parameter: types.boolean,
        return: types.boolean,
      },
      argument => {
        if (!nodeIsBoolean(argument)) {
          return either.makeLeft({
            kind: 'panic',
            message: 'argument was not a boolean',
          })
        } else {
          return either.makeRight(
            argument.atom === 'true'
              ? makeAtomNode('false')
              : makeAtomNode('true'),
          )
        }
      },
    ),
  }),

  match: preludeFunction(
    ['match'],
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
            () =>
              either.map(serializeObjectNode(cases), serializedCases => ({
                0: '@apply',
                1: { 0: '@lookup', 1: { 0: 'match' } },
                2: serializedCases,
              })),
            argument => {
              if (!nodeIsTagged(argument)) {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'argument was not tagged',
                })
              } else {
                const relevantCase = cases.children[argument.children.tag.atom]
                if (relevantCase === undefined) {
                  return either.makeLeft({
                    kind: 'panic',
                    message: `case for tag '${argument.children.tag.atom}' was not defined`,
                  })
                } else {
                  return !isFunctionNode(relevantCase)
                    ? either.makeRight(relevantCase)
                    : relevantCase.function(argument.children.value)
                }
              }
            },
          ),
        )
      }
    },
  ),

  object: makeObjectNode({
    lookup: preludeFunction(
      ['object', 'lookup'],
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
              () =>
                either.makeRight({
                  0: '@apply',
                  1: { 0: '@lookup', 1: { 0: 'object', 1: 'lookup' } },
                  2: key.atom,
                }),
              argument => {
                if (!isObjectNode(argument)) {
                  return either.makeLeft({
                    kind: 'panic',
                    message: 'argument was not an object',
                  })
                } else {
                  const propertyValue = argument.children[key.atom]
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
const nodeIsBoolean = (
  node: PartiallyElaboratedSemanticGraph,
): node is BooleanNode =>
  isAtomNode(node) && (node.atom === 'true' || node.atom === 'false')

type TaggedNode = ObjectNode & {
  readonly children: {
    readonly tag: AtomNode
    readonly value: FullyElaboratedSemanticGraph
  }
}
const nodeIsTagged = (
  node: PartiallyElaboratedSemanticGraph,
): node is TaggedNode =>
  isPartiallyElaboratedObjectNode(node) &&
  node.children.tag !== undefined &&
  (typeof node.children.tag === 'string' ||
    (isPartiallyElaboratedSemanticGraph(node.children.tag) &&
      isAtomNode(node.children.tag))) &&
  node.children.value !== undefined
