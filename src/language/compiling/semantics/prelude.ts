import { either, option, type Either } from '../../../adts.js'
import type { DependencyUnavailable, Panic } from '../../errors.js'
import type { Atom } from '../../parsing.js'
import {
  isFunctionNode,
  isObjectNode,
  makeFunctionNode,
  makeObjectNode,
  types,
  type ObjectNode,
} from '../../semantics.js'
import {
  lookupPropertyOfObjectNode,
  makeUnelaboratedObjectNode,
  serializeObjectNode,
} from '../../semantics/object-node.js'
import {
  containsAnyUnelaboratedNodes,
  isSemanticGraph,
  serialize,
  type SemanticGraph,
} from '../../semantics/semantic-graph.js'
import {
  makeFunctionType,
  makeObjectType,
  makeTypeParameter,
  type FunctionType,
} from '../../semantics/type-system/type-formats.js'

const handleUnavailableDependencies =
  (
    f: (
      argument: SemanticGraph,
    ) => Either<DependencyUnavailable | Panic, SemanticGraph>,
  ) =>
  (
    argument: SemanticGraph,
  ): Either<DependencyUnavailable | Panic, SemanticGraph> => {
    if (containsAnyUnelaboratedNodes(argument)) {
      return either.makeLeft({
        kind: 'dependencyUnavailable',
        message: 'one or more dependencies are unavailable',
      })
    } else {
      return f(argument)
    }
  }

const preludeFunction = (
  keyPath: readonly string[],
  signature: FunctionType['signature'],
  f: (
    value: SemanticGraph,
  ) => Either<DependencyUnavailable | Panic, SemanticGraph>,
) =>
  makeFunctionNode(
    signature,
    () =>
      either.makeRight(
        makeUnelaboratedObjectNode({
          0: '@lookup',
          query: Object.fromEntries(keyPath.map((key, index) => [index, key])),
        }),
      ),
    option.none,
    handleUnavailableDependencies(f),
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
            either.map(serialize(argument), serializedArgument =>
              makeUnelaboratedObjectNode({
                0: '@apply',
                function: { 0: '@lookup', query: { 0: 'apply' } },
                argument: serializedArgument,
              }),
            ),
          option.none,
          functionToApply => {
            if (!isFunctionNode(functionToApply)) {
              return either.makeLeft({
                kind: 'panic',
                message: 'expected a function',
              })
            } else {
              return functionToApply(argument)
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
      } else {
        const argument0 = lookupPropertyOfObjectNode('0', argument)
        const argument1 = lookupPropertyOfObjectNode('1', argument)
        if (option.isNone(argument0) || option.isNone(argument1)) {
          return either.makeLeft({
            kind: 'panic',
            message:
              "`flow`'s argument must contain properties named '0' and '1'",
          })
        } else if (
          !isFunctionNode(argument0.value) ||
          !isFunctionNode(argument1.value)
        ) {
          return either.makeLeft({
            kind: 'panic',
            message: "`flow`'s argument must contain functions",
          })
        } else {
          const function0 = argument0.value
          const function1 = argument1.value
          return either.makeRight(
            makeFunctionNode(
              {
                parameter: function0.signature.parameter,
                return: function1.signature.parameter,
              },
              () =>
                either.flatMap(function0.serialize(), serializedFunction0 =>
                  either.map(function1.serialize(), serializedFunction1 =>
                    makeUnelaboratedObjectNode({
                      0: '@apply',
                      function: { 0: '@lookup', query: { 0: 'flow' } },
                      argument: makeUnelaboratedObjectNode({
                        0: serializedFunction0,
                        1: serializedFunction1,
                      }),
                    }),
                  ),
                ),
              option.none,
              argument => either.flatMap(function0(argument), function1),
            ),
          )
        }
      }
    },
  ),

  identity: preludeFunction(
    ['identity'],
    { parameter: A, return: A },
    either.makeRight,
  ),

  boolean: makeObjectNode({
    true: 'true',
    false: 'false',
    is: preludeFunction(
      ['boolean', 'is'],
      {
        parameter: types.something,
        return: types.boolean,
      },
      argument => either.makeRight(nodeIsBoolean(argument) ? 'true' : 'false'),
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
          return either.makeRight(argument === 'true' ? 'false' : 'true')
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
              either.map(serializeObjectNode(cases), serializedCases =>
                makeUnelaboratedObjectNode({
                  0: '@apply',
                  function: { 0: '@lookup', query: { 0: 'match' } },
                  argument: serializedCases,
                }),
              ),
            option.none,
            argument => {
              if (!nodeIsTagged(argument)) {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'argument was not tagged',
                })
              } else {
                const relevantCase = lookupPropertyOfObjectNode(
                  argument.tag,
                  cases,
                )
                if (option.isNone(relevantCase)) {
                  return either.makeLeft({
                    kind: 'panic',
                    message: `case for tag '${argument.tag}' was not defined`,
                  })
                } else {
                  return !isFunctionNode(relevantCase.value)
                    ? either.makeRight(relevantCase.value)
                    : relevantCase.value(argument.value)
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
        if (typeof key !== 'string') {
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
                either.makeRight(
                  makeUnelaboratedObjectNode({
                    0: '@apply',
                    function: {
                      0: '@lookup',
                      query: { 0: 'object', 1: 'lookup' },
                    },
                    argument: key,
                  }),
                ),
              option.none,
              argument => {
                if (!isObjectNode(argument)) {
                  return either.makeLeft({
                    kind: 'panic',
                    message: 'argument was not an object',
                  })
                } else {
                  const propertyValue = argument[key]
                  if (propertyValue === undefined) {
                    return either.makeRight(
                      makeObjectNode({
                        tag: 'none',
                        value: makeObjectNode({}),
                      }),
                    )
                  } else {
                    return either.makeRight(
                      makeObjectNode({
                        tag: 'some',
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

  string: makeObjectNode({
    concatenate: preludeFunction(
      ['string', 'concatenate'],
      {
        parameter: types.string,
        return: makeFunctionType('', {
          parameter: types.string,
          return: types.string,
        }),
      },
      string1 =>
        either.makeRight(
          makeFunctionNode(
            {
              parameter: types.string,
              return: types.string,
            },
            () =>
              either.makeRight(
                makeUnelaboratedObjectNode({
                  0: '@apply',
                  function: {
                    0: '@lookup',
                    query: { 0: 'string', 1: 'concatenate' },
                  },
                  argument: string1,
                }),
              ),
            option.none,
            string2 => {
              if (typeof string1 !== 'string' || typeof string2 !== 'string') {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'concatenate received a non-string argument',
                })
              } else {
                return either.makeRight(string1 + string2)
              }
            },
          ),
        ),
    ),
  }),
})

type BooleanNode = 'true' | 'false'
const nodeIsBoolean = (node: SemanticGraph): node is BooleanNode =>
  node === 'true' || node === 'false'

type TaggedNode = ObjectNode & {
  readonly tag: Atom
  readonly value: SemanticGraph
}
const nodeIsTagged = (node: SemanticGraph): node is TaggedNode =>
  isObjectNode(node) &&
  node.tag !== undefined &&
  (typeof node.tag === 'string' ||
    (isSemanticGraph(node.tag) && typeof node.tag === 'string')) &&
  node.value !== undefined
