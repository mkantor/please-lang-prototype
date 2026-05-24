import { testCases } from '../../../test-utilities.test.js'
import { stringifyKeyPathForEndUser, type KeyPath } from '../key-path.js'
import {
  atom,
  integer,
  naturalNumber,
  nothing,
  object,
  option,
  something,
} from './prelude-types.js'
import { showType } from './show-type.js'
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
  genericizeFunctionParameterAnnotation,
  getTypesForTypeParameters,
} from './type-utilities.js'

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
    showType(applyKeyPathToType(type, keyPath)),
  ([type, keyPath]) =>
    `applying key path \`${stringifyKeyPathForEndUser(keyPath)}\` to \`${showType(type)}\``,
)

applyKeyPathSuite('applyKeyPathToType with empty key path', [
  [[atom, []], showType(atom)],
  [[nothing, []], showType(nothing)],
  [[something, []], showType(something)],
  [
    [makeObjectType('', { a: atom }), []],
    showType(makeObjectType('', { a: atom })),
  ],
  [
    [makeFunctionType('', { parameter: atom, return: something }), []],
    showType(makeFunctionType('', { parameter: atom, return: something })),
  ],
])

applyKeyPathSuite('applyKeyPathToType with object types', [
  [[makeObjectType('', { a: atom, b: integer }), ['a']], showType(atom)],
  [[makeObjectType('', { a: atom, b: integer }), ['b']], showType(integer)],
  [[makeObjectType('', { a: atom }), ['z']], showType(nothing)],
  [
    [
      makeObjectType('', {
        a: makeObjectType('', { b: makeUnionType('', ['hello']) }),
      }),
      ['a', 'b'],
    ],
    showType(makeUnionType('', ['hello'])),
  ],
  [[makeObjectType('', { a: atom }), ['a', 'b']], showType(nothing)],
])

applyKeyPathSuite('applyKeyPathToType with non-object types', [
  [
    [makeFunctionType('', { parameter: atom, return: something }), ['a']],
    showType(nothing),
  ],
  [[atom, ['a']], showType(nothing)],
  [[integer, ['a']], showType(nothing)],
  [[A, ['a']], showType(nothing)],
])

applyKeyPathSuite('applyKeyPathToType with union types', [
  [
    [
      makeUnionType('', [
        makeObjectType('', { a: makeUnionType('', ['x']) }),
        makeObjectType('', { a: makeUnionType('', ['y']) }),
      ]),
      ['a'],
    ],
    showType(makeUnionType('', ['x', 'y'])),
  ],
  [
    [
      makeUnionType('', [
        makeObjectType('', { a: makeUnionType('', ['x']) }),
        'some_atom',
      ]),
      ['a'],
    ],
    showType(makeUnionType('', ['x'])),
  ],
  [
    [
      makeUnionType('', [
        makeObjectType('', { b: atom }),
        makeObjectType('', { c: atom }),
      ]),
      ['a'],
    ],
    showType(nothing),
  ],
  [
    [
      makeUnionType('', [
        makeObjectType('', { a: integer }),
        makeFunctionType('', { parameter: atom, return: atom }),
      ]),
      ['a'],
    ],
    showType(integer),
  ],
])

const getTypesForTypeParametersSuite = testCases(
  ([parameterType, argumentType]: readonly [
    parameterType: Type,
    argumentType: Type,
  ]) => getTypesForTypeParameters({ parameterType, argumentType }),
  ([parameterType, argumentType]) =>
    `getting types for type parameters in \`${showType(parameterType)}\` from \`${showType(argumentType)}\``,
)

getTypesForTypeParametersSuite('getTypesForTypeParameters', [
  [[A, atom], new Map([[A, atom]])],

  [[extendsAnyAtom, atom], new Map([[extendsAnyAtom, atom]])],

  [[something, atom], new Map()],

  [[makeObjectType('', { a: A }), atom], new Map()],

  [
    [
      makeObjectType('', { a: A, b: B }),
      makeObjectType('', { a: atom, b: integer }),
    ],
    new Map([
      [A, atom],
      [B, integer],
    ]),
  ],

  [
    [
      makeFunctionType('', { parameter: A, return: B }),
      makeFunctionType('', { parameter: atom, return: integer }),
    ],
    new Map([
      [A, atom],
      [B, integer],
    ]),
  ],

  [
    [
      makeFunctionType('', { parameter: A, return: A }),
      makeFunctionType('', { parameter: atom, return: integer }),
    ],
    // The first occurrence should be used in situations like this. In real code
    // this will likely result in a type error later.
    new Map([[A, atom]]),
  ],

  [
    [
      makeObjectType('', { a: A, b: A }),
      makeObjectType('', { a: atom, b: integer }),
    ],
    // The first occurrence should be used in situations like this. In real code
    // this will likely result in a type error later.
    new Map([[A, atom]]),
  ],

  [[extendsAnyAtom, object], new Map()],

  [[makeUnionType('', [A, atom]), object], new Map([[A, object]])],

  [[makeUnionType('', [A, atom]), something], new Map([[A, something]])],

  [[makeUnionType('', [A, atom]), atom], new Map([[A, atom]])],

  [
    [makeUnionType('', [A, object]), makeUnionType('', ['specific atom'])],
    new Map([[A, makeUnionType('', ['specific atom'])]]),
  ],

  [
    [
      makeUnionType('', [extendsAnyAtom, object]),
      makeUnionType('', ['specific atom', object]),
    ],
    new Map([
      [extendsAnyAtom, makeUnionType('specific atom', ['specific atom'])],
    ]),
  ],

  [[makeUnionType('', [extendsAnyAtom, object]), object], new Map()],

  [[option(A), option(naturalNumber)], new Map([[A, naturalNumber]])],

  [
    [
      makeFunctionType('', { parameter: A, return: option(B) }),
      makeFunctionType('', {
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
    showType(genericizeFunctionParameterAnnotation(parameterName, annotation)),
  ([parameterName, annotation]) =>
    `genericizing \`${parameterName}: ${showType(annotation)}\``,
)

genericizeParameterAnnotationSuite('genericizeParameterAnnotation', [
  [['a', atom], '(a <: atom)'],

  [['a', integer], '(a <: integer)'],

  [['a', makeUnionType('', ['foo', 'bar'])], '(a <: ("foo" | "bar"))'],

  [['a', something], 'a'],

  [
    [
      'x',
      makeObjectType('', {
        a: integer,
        b: atom,
      }),
    ],
    '{ a: (x.a <: integer), b: (x.b <: atom) }',
  ],

  [
    [
      'x',
      makeObjectType('', {
        a: makeObjectType('', { b: atom }),
      }),
    ],
    '{ a: { b: (x.a.b <: atom) } }',
  ],

  [
    [
      'x',
      makeObjectType('', {
        callback: makeFunctionType('', { parameter: atom, return: integer }),
      }),
    ],
    '{ callback: (x.callback.#parameter <: atom) ~> (x.callback.#return <: integer) }',
  ],

  [['empty', makeObjectType('', {})], '{}'],

  [
    ['identity', makeFunctionType('', { parameter: A, return: A })],
    `${showType(A)} ~> ${showType(A)}`,
  ],

  [['wrap', makeObjectType('', { value: A })], `{ value: ${showType(A)} }`],
])
