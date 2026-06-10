import { testCases } from '../../../test-utilities.test.js'
import { stringifyKeyPathForEndUser, type KeyPath } from '../key-path.js'
import { stringifyTypeForEndUser } from '../semantic-graph.js'
import { genericizeFunctionParameterAnnotation } from './genericize-function-parameter.js'
import {
  atom,
  integer,
  naturalNumber,
  nothing,
  object,
  option,
  something,
} from './prelude-types.js'
import {
  makeFunctionType,
  makeObjectType,
  makeTypeParameter,
  makeUnionType,
  type Type,
  type TypeParameter,
} from './type-formats.js'
import {
  applyKeyPathToType,
  getTypesForTypeParameters,
} from './type-substitution.js'

const A = makeTypeParameter('a', { assignableTo: something })
const B = makeTypeParameter('b', { assignableTo: something })

const extendsAnyAtom = makeTypeParameter('z', {
  assignableTo: atom,
})

const applyKeyPathSuite = testCases(
  // For now non-atom key paths are not exposed in the language (e.g. you cannot
  // dynamically refer to function parameters/returns). If that changes, this
  // will need to be updated.
  ([type, keyPath]: [type: Type, keyPath: KeyPath]) =>
    stringifyTypeForEndUser(applyKeyPathToType(type, keyPath)),
  ([type, keyPath]) =>
    `applying key path \`${stringifyKeyPathForEndUser(keyPath)}\` to \`${stringifyTypeForEndUser(type)}\``,
)

applyKeyPathSuite('applyKeyPathToType with empty key path', [
  [[atom, []], stringifyTypeForEndUser(atom)],
  [[nothing, []], stringifyTypeForEndUser(nothing)],
  [[something, []], stringifyTypeForEndUser(something)],
  [
    [makeObjectType({ a: atom }), []],
    stringifyTypeForEndUser(makeObjectType({ a: atom })),
  ],
  [
    [makeFunctionType({ parameter: atom, return: something }), []],
    stringifyTypeForEndUser(
      makeFunctionType({ parameter: atom, return: something }),
    ),
  ],
])

applyKeyPathSuite('applyKeyPathToType with object types', [
  [
    [makeObjectType({ a: atom, b: integer }), ['a']],
    stringifyTypeForEndUser(atom),
  ],
  [
    [makeObjectType({ a: atom, b: integer }), ['b']],
    stringifyTypeForEndUser(integer),
  ],
  [[makeObjectType({ a: atom }), ['z']], stringifyTypeForEndUser(nothing)],
  [
    [
      makeObjectType({
        a: makeObjectType({ b: makeUnionType(['hello']) }),
      }),
      ['a', 'b'],
    ],
    stringifyTypeForEndUser(makeUnionType(['hello'])),
  ],
  [[makeObjectType({ a: atom }), ['a', 'b']], stringifyTypeForEndUser(nothing)],
])

applyKeyPathSuite('applyKeyPathToType with non-object types', [
  [
    [makeFunctionType({ parameter: atom, return: something }), ['a']],
    stringifyTypeForEndUser(nothing),
  ],
  [[atom, ['a']], stringifyTypeForEndUser(nothing)],
  [[integer, ['a']], stringifyTypeForEndUser(nothing)],
  [[A, ['a']], stringifyTypeForEndUser(nothing)],
])

applyKeyPathSuite('applyKeyPathToType with union types', [
  [
    [
      makeUnionType([
        makeObjectType({ a: makeUnionType(['x']) }),
        makeObjectType({ a: makeUnionType(['y']) }),
      ]),
      ['a'],
    ],
    stringifyTypeForEndUser(makeUnionType(['x', 'y'])),
  ],
  [
    [
      makeUnionType([makeObjectType({ a: makeUnionType(['x']) }), 'some_atom']),
      ['a'],
    ],
    stringifyTypeForEndUser(nothing),
  ],
  [
    [
      makeUnionType([makeObjectType({ b: atom }), makeObjectType({ c: atom })]),
      ['a'],
    ],
    stringifyTypeForEndUser(nothing),
  ],
  [
    [
      makeUnionType([
        makeObjectType({ a: integer }),
        makeFunctionType({ parameter: atom, return: atom }),
      ]),
      ['a'],
    ],
    stringifyTypeForEndUser(nothing),
  ],
])

const getTypesForTypeParametersSuite = testCases(
  ([parameterType, argumentType]: readonly [
    parameterType: Type,
    argumentType: Type,
  ]) => getTypesForTypeParameters({ parameterType, argumentType }),
  ([parameterType, argumentType]) =>
    `getting types for type parameters in \`${stringifyTypeForEndUser(parameterType)}\` from \`${stringifyTypeForEndUser(argumentType)}\``,
)

getTypesForTypeParametersSuite('getTypesForTypeParameters', [
  [[A, atom], new Map([[A, atom]])],

  [[extendsAnyAtom, atom], new Map([[extendsAnyAtom, atom]])],

  [[something, atom], new Map()],

  [[makeObjectType({ a: A }), atom], new Map()],

  [
    [makeObjectType({ a: A, b: B }), makeObjectType({ a: atom, b: integer })],
    new Map([
      [A, atom],
      [B, integer],
    ]),
  ],

  [
    [
      makeFunctionType({ parameter: A, return: B }),
      makeFunctionType({ parameter: atom, return: integer }),
    ],
    new Map([
      [A, atom],
      [B, integer],
    ]),
  ],

  [
    [
      makeFunctionType({ parameter: A, return: A }),
      makeFunctionType({ parameter: atom, return: integer }),
    ],
    // The first occurrence should be used in situations like this. In real code
    // this will likely result in a type error later.
    new Map([[A, atom]]),
  ],

  [
    [makeObjectType({ a: A, b: A }), makeObjectType({ a: atom, b: integer })],
    // The first occurrence should be used in situations like this. In real code
    // this will likely result in a type error later.
    new Map([[A, atom]]),
  ],

  [[extendsAnyAtom, object], new Map()],

  [[makeUnionType([A, atom]), object], new Map([[A, object]])],

  [[makeUnionType([A, atom]), something], new Map([[A, something]])],

  [[makeUnionType([A, atom]), atom], new Map([[A, atom]])],

  [
    [makeUnionType([A, object]), makeUnionType(['specific atom'])],
    new Map([[A, makeUnionType(['specific atom'])]]),
  ],

  [
    [
      makeUnionType([extendsAnyAtom, object]),
      makeUnionType(['specific atom', object]),
    ],
    new Map([[extendsAnyAtom, makeUnionType(['specific atom'])]]),
  ],

  [[makeUnionType([extendsAnyAtom, object]), object], new Map()],

  [[option(A), option(naturalNumber)], new Map([[A, naturalNumber]])],

  [
    [
      makeFunctionType({ parameter: A, return: option(B) }),
      makeFunctionType({
        parameter: atom,
        return: option(naturalNumber),
      }),
    ],
    new Map<TypeParameter, Type>([
      [A, atom],
      [B, naturalNumber],
    ]),
  ],
])

const genericizeParameterAnnotationSuite = testCases(
  ([parameterName, annotation]: readonly [
    parameterName: string,
    annotation: Type,
  ]) =>
    // I'd prefer to check the actual `Type` rather than its string
    // representation, but since synthesized type parameters contain fresh
    // symbols they can't be structurally compared to `Type`s instantiated here.
    // TODO: Consider traversing the returned type to substitute symbols.
    stringifyTypeForEndUser(
      genericizeFunctionParameterAnnotation(parameterName, annotation).type,
    ),
  ([parameterName, annotation]) =>
    `genericizing \`${parameterName}: ${stringifyTypeForEndUser(annotation)}\``,
)

genericizeParameterAnnotationSuite('genericizeParameterAnnotation', [
  [['a', atom], '(?a: :atom.type)'],

  [['a', integer], '(?a: :integer.type)'],

  [['a', makeUnionType(['foo', 'bar'])], '(?a: foo | bar)'],

  [['a', something], '?a'],

  [
    [
      'x',
      makeObjectType({
        a: integer,
        b: atom,
      }),
    ],
    '{ a: (?"x.a": :integer.type), b: (?"x.b": :atom.type) }',
  ],

  [
    [
      'x',
      makeObjectType({
        a: makeObjectType({ b: atom }),
      }),
    ],
    '{ a: { b: (?"x.a.b": :atom.type) } }',
  ],

  [
    [
      'x',
      makeObjectType({
        callback: makeFunctionType({ parameter: atom, return: integer }),
      }),
    ],
    '{ callback: (?"x.callback.#parameter": :atom.type) ~> (?"x.callback.#return": :integer.type) }',
  ],

  [['empty', makeObjectType({})], '{}'],

  [['identity', makeFunctionType({ parameter: A, return: A })], '?a ~> :a'],

  [
    ['wrap', makeObjectType({ value: A })],
    `{ value: ${stringifyTypeForEndUser(A)} }`,
  ],
])
