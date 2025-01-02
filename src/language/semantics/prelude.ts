import { either, option, type Either } from '../../adts.js'
import type { DependencyUnavailable, Panic } from '../errors.js'
import type { Atom } from '../parsing.js'
import { isFunctionNode, makeFunctionNode } from './function-node.js'
import { keyPathToMolecule, type KeyPath } from './key-path.js'
import {
  isObjectNode,
  lookupPropertyOfObjectNode,
  makeObjectNode,
  makeUnelaboratedObjectNode,
  type ObjectNode,
} from './object-node.js'
import {
  containsAnyUnelaboratedNodes,
  isSemanticGraph,
  type SemanticGraph,
} from './semantic-graph.js'
import { types } from './type-system.js'
import {
  makeFunctionType,
  makeObjectType,
  makeTypeParameter,
  makeUnionType,
  type FunctionType,
} from './type-system/type-formats.js'

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

const serializePartiallyAppliedFunction =
  (keyPath: KeyPath, argument: SemanticGraph) => () =>
    either.makeRight(
      makeUnelaboratedObjectNode({
        0: '@apply',
        function: { 0: '@lookup', query: keyPathToMolecule(keyPath) },
        argument,
      }),
    )

const preludeFunction = (
  keyPath: KeyPath,
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
          query: keyPathToMolecule(keyPath),
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
          serializePartiallyAppliedFunction(['apply'], argument),
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
              serializePartiallyAppliedFunction(
                ['flow'],
                makeObjectNode({ 0: function0, 1: function1 }),
              ),
              option.none,
              argument => either.flatMap(function0(argument), function1),
            ),
          )
        }
      }
    },
  ),

  integer: makeObjectNode({
    add: preludeFunction(
      ['integer', 'add'],
      {
        parameter: types.integer,
        return: makeFunctionType('', {
          parameter: types.integer,
          return: types.integer,
        }),
      },
      number2 =>
        either.makeRight(
          makeFunctionNode(
            {
              parameter: types.integer,
              return: types.integer,
            },
            serializePartiallyAppliedFunction(['integer', 'add'], number2),
            option.none,
            number1 => {
              if (
                typeof number1 !== 'string' ||
                !types.integer.isAssignableFrom(makeUnionType('', [number1])) ||
                typeof number2 !== 'string' ||
                !types.integer.isAssignableFrom(makeUnionType('', [number2]))
              ) {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'numbers must be atoms',
                })
              } else {
                return either.makeRight(
                  // TODO: See comment in `natural_number.add`.
                  String(BigInt(number1) + BigInt(number2)),
                )
              }
            },
          ),
        ),
    ),
    less_than: preludeFunction(
      ['integer', 'less_than'],
      {
        parameter: types.integer,
        return: makeFunctionType('', {
          parameter: types.integer,
          return: types.integer,
        }),
      },
      number2 =>
        either.makeRight(
          makeFunctionNode(
            {
              parameter: types.integer,
              return: types.boolean,
            },
            serializePartiallyAppliedFunction(
              ['integer', 'less_than'],
              number2,
            ),
            option.none,
            number1 => {
              if (
                typeof number1 !== 'string' ||
                !types.integer.isAssignableFrom(makeUnionType('', [number1])) ||
                typeof number2 !== 'string' ||
                !types.integer.isAssignableFrom(makeUnionType('', [number2]))
              ) {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'numbers must be atoms',
                })
              } else {
                return either.makeRight(
                  // TODO: See comment in `natural_number.add`.
                  String(BigInt(number1) < BigInt(number2)),
                )
              }
            },
          ),
        ),
    ),
    subtract: preludeFunction(
      ['integer', 'subtract'],
      {
        parameter: types.integer,
        return: makeFunctionType('', {
          parameter: types.integer,
          return: types.integer,
        }),
      },
      number2 =>
        either.makeRight(
          makeFunctionNode(
            {
              parameter: types.integer,
              return: types.integer,
            },
            serializePartiallyAppliedFunction(['integer', 'subtract'], number2),
            option.none,
            number1 => {
              if (
                typeof number1 !== 'string' ||
                !types.integer.isAssignableFrom(makeUnionType('', [number1])) ||
                typeof number2 !== 'string' ||
                !types.integer.isAssignableFrom(makeUnionType('', [number2]))
              ) {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'numbers must be atoms',
                })
              } else {
                return either.makeRight(
                  // TODO: See comment in `natural_number.add`.
                  String(BigInt(number1) - BigInt(number2)),
                )
              }
            },
          ),
        ),
    ),
  }),

  identity: preludeFunction(
    ['identity'],
    { parameter: A, return: A },
    either.makeRight,
  ),

  boolean: makeObjectNode({
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
            serializePartiallyAppliedFunction(['match'], cases),
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

  natural_number: makeObjectNode({
    add: preludeFunction(
      ['natural_number', 'add'],
      {
        parameter: types.naturalNumber,
        return: makeFunctionType('', {
          parameter: types.naturalNumber,
          return: types.naturalNumber,
        }),
      },
      number2 =>
        either.makeRight(
          makeFunctionNode(
            {
              parameter: types.naturalNumber,
              return: types.naturalNumber,
            },
            serializePartiallyAppliedFunction(
              ['natural_number', 'add'],
              number2,
            ),
            option.none,
            number1 => {
              if (
                typeof number1 !== 'string' ||
                !types.naturalNumber.isAssignableFrom(
                  makeUnionType('', [number1]),
                ) ||
                typeof number2 !== 'string' ||
                !types.naturalNumber.isAssignableFrom(
                  makeUnionType('', [number2]),
                )
              ) {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'numbers must be atoms',
                })
              } else {
                return either.makeRight(
                  // FIXME: It's wasteful to always convert here.
                  //
                  // Consider `add(add(1)(1))(1)`—the `2` returned from the inner `add` is
                  // stringified only to be converted back to a bigint. This is acceptable for the
                  // prototype, but a real implementation could use a fancier `SemanticGraph` which
                  // can model atoms as different native data types.
                  String(BigInt(number1) + BigInt(number2)),
                )
              }
            },
          ),
        ),
    ),
  }),

  object: makeObjectNode({
    lookup: preludeFunction(
      ['object', 'lookup'],
      {
        // TODO
        parameter: types.atom,
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
              serializePartiallyAppliedFunction(['object', 'lookup'], key),
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

  atom: makeObjectNode({
    concatenate: preludeFunction(
      ['atom', 'concatenate'],
      {
        parameter: types.atom,
        return: makeFunctionType('', {
          parameter: types.atom,
          return: types.atom,
        }),
      },
      string2 =>
        either.makeRight(
          makeFunctionNode(
            {
              parameter: types.atom,
              return: types.atom,
            },
            serializePartiallyAppliedFunction(['atom', 'concatenate'], string2),
            option.none,
            string1 => {
              if (typeof string1 !== 'string' || typeof string1 !== 'string') {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'concatenate received a non-atom argument',
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
