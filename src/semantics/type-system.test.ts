import { testCases } from '../test-utilities.test.js'
import {
  boolean,
  functionType,
  nothing,
  nullType,
  object,
  something,
  string,
} from './type-system/prelude-types.js'
import { showType } from './type-system/show-type.js'
import { isAssignable, simplifyUnionType } from './type-system/subtyping.js'
import {
  makeFunctionType,
  makeObjectType,
  makeTypeParameter,
  makeUnionType,
  type Type,
  type UnionType,
} from './type-system/type-formats.js'

const typeAssignabilitySuite = testCases(
  ([source, target]: [source: Type, target: Type]) =>
    isAssignable({ source, target }),
  ([source, target]) =>
    `assignability of \`${showType(source)}\` to \`${showType(target)}\``,
)

const A = makeTypeParameter('a', { assignableTo: something })
const B = makeTypeParameter('b', { assignableTo: something })
const C = makeTypeParameter('c', { assignableTo: something })
const D = makeTypeParameter('d', { assignableTo: something })

const extendsString = makeTypeParameter('z', {
  assignableTo: string,
})
const extendsAtom = makeTypeParameter('y', {
  assignableTo: makeUnionType('', ['a']),
})
const extendsUnionOfAtoms = makeTypeParameter('x', {
  assignableTo: makeUnionType('', ['a', 'b']),
})
const extendsA = makeTypeParameter('w', {
  assignableTo: A,
})
const extendsFunctionFromStringToValue = makeTypeParameter('i', {
  assignableTo: makeFunctionType('', { parameter: string, return: something }),
})
const extendsFunctionFromValueToString = makeTypeParameter('v', {
  assignableTo: makeFunctionType('', { parameter: something, return: string }),
})
const extendsExtendsString = makeTypeParameter('u', {
  assignableTo: extendsString,
})

testCases(
  (type: UnionType) => showType(simplifyUnionType(type)),
  type => `simplifying type \`${showType(type)}\``,
)('simplifying union types', [
  [
    makeUnionType('', [
      'a',
      string,
      makeObjectType('', {
        a: makeUnionType('', ['a', 'b']),
      }),
      makeObjectType('', {
        a: makeUnionType('', ['b']),
      }),
      makeObjectType('', {
        a: makeUnionType('', ['c']),
      }),
    ]),
    '(string | { a: ("a" | "b" | "c") })',
  ],
])
typeAssignabilitySuite('prelude types (assignable)', [
  [
    [
      makeFunctionType('', { parameter: something, return: something }),
      makeFunctionType('', { parameter: something, return: something }),
    ],
    true,
  ],
])

typeAssignabilitySuite('prelude types (assignable)', [
  [[nothing, nothing], true],
  [[nullType, nullType], true],
  [[boolean, boolean], true],
  [[string, string], true],
  [[object, object], true],
  [[functionType, functionType], true],
  [[something, something], true],
  [[nothing, nullType], true],
  [[nothing, string], true],
  [[nothing, object], true],
  [[nothing, functionType], true],
  [[nothing, something], true],
  [[nullType, string], true],
  [[nullType, something], true],
  [[boolean, string], true],
  [[boolean, something], true],
  [[string, something], true],
  [[object, something], true],
  [[functionType, something], true],
])

typeAssignabilitySuite('prelude types (not assignable)', [
  [[nullType, nothing], false],
  [[nullType, boolean], false],
  [[nullType, object], false],
  [[nullType, functionType], false],
  [[boolean, nothing], false],
  [[boolean, nullType], false],
  [[boolean, object], false],
  [[boolean, functionType], false],
  [[string, nothing], false],
  [[string, nullType], false],
  [[string, boolean], false],
  [[string, object], false],
  [[string, functionType], false],
  [[object, nothing], false],
  [[object, nullType], false],
  [[object, boolean], false],
  [[object, string], false],
  [[object, functionType], false],
  [[functionType, nothing], false],
  [[functionType, nullType], false],
  [[functionType, boolean], false],
  [[functionType, string], false],
  [[functionType, object], false],
  [[something, nothing], false],
  [[something, nullType], false],
  [[something, boolean], false],
  [[something, string], false],
  [[something, object], false],
  [[something, functionType], false],
])

typeAssignabilitySuite('custom types (assignable)', [
  [[makeUnionType('', ['a']), makeUnionType('', ['a', 'b'])], true],
  [[makeUnionType('', ['a']), string], true],
  [[makeUnionType('', ['a', 'b']), string], true],
  [[makeUnionType('', ['a']), makeUnionType('', [string, 'b'])], true],
  [
    [
      makeObjectType('', {
        a: makeUnionType('', ['a']),
        b: object,
      }),
      makeObjectType('', {
        a: string,
        b: object,
      }),
    ],
    true,
  ],
  [
    [
      makeObjectType('', {
        a: makeUnionType('', ['a']),
        b: makeObjectType('', { c: boolean }),
        c: nullType,
      }),
      makeObjectType('', {
        a: string,
        b: object,
      }),
    ],
    true,
  ],
  [
    [
      makeObjectType('', {
        a: makeUnionType('', ['a']),
      }),
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
        }),
      ]),
    ],
    true,
  ],
  [
    [
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
        }),
      ]),
      makeObjectType('', {
        a: makeUnionType('', ['a']),
      }),
    ],
    true,
  ],
  [
    [
      // `{ a: 'a' } | { a: 'b' }` is assignable to `{ a: 'a' | 'b' }`
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
        }),
        makeObjectType('', {
          a: makeUnionType('', ['b']),
        }),
      ]),
      makeObjectType('', {
        a: makeUnionType('', ['a', 'b']),
      }),
    ],
    true,
  ],
  [
    [
      // `{ a: 'a' } | { a: 'b' }` is assignable to `{ a: 'a' | 'b' | 'c' }`
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
        }),
        makeObjectType('', {
          a: makeUnionType('', ['b']),
        }),
      ]),
      makeObjectType('', {
        a: makeUnionType('', ['a', 'b', 'c']),
      }),
    ],
    true,
  ],
  [
    [
      // `{ a: 'a', b: 'a' } | { a: 'b', b: 'b' }` is assignable to `{ a: 'a' | 'b', b: 'a' | 'b' }`
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
          b: makeUnionType('', ['a']),
        }),
        makeObjectType('', {
          a: makeUnionType('', ['b']),
          b: makeUnionType('', ['b']),
        }),
      ]),
      makeObjectType('', {
        a: makeUnionType('', ['a', 'b']),
        b: makeUnionType('', ['a', 'b']),
      }),
    ],
    true,
  ],
  [
    [
      // `{ a: 'a' } | { a: 'b' } | 'c'` is assignable to `{ a: 'a' | 'b' } | 'c'`
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
        }),
        makeObjectType('', {
          a: makeUnionType('', ['b']),
        }),
        'c',
      ]),
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a', 'b']),
        }),
        'c',
      ]),
    ],
    true,
  ],
  [
    [
      // `{ a: 'a' | 'b' }` is assignable to `{ a: 'a' } | { a: 'b' }`
      makeObjectType('', {
        a: makeUnionType('', ['a', 'b']),
      }),
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
        }),
        makeObjectType('', {
          a: makeUnionType('', ['b']),
        }),
      ]),
    ],
    true,
  ],
  [
    [
      // `{ a: 'a' | 'b' }` is assignable to `{ a: 'a' } | { a: 'b' } | { a: 'c' }`
      makeObjectType('', {
        a: makeUnionType('', ['a', 'b']),
      }),
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
        }),
        makeObjectType('', {
          a: makeUnionType('', ['b']),
        }),
        makeObjectType('', {
          a: makeUnionType('', ['c']),
        }),
      ]),
    ],
    true,
  ],
  [
    [
      // `{ a: { a: 'a' | 'b' } }` is assignable to `{ a: { a: 'a' } | { a: 'b' } }`
      makeObjectType('', {
        a: makeObjectType('', {
          a: makeUnionType('', ['a', 'b']),
        }),
      }),
      makeObjectType('', {
        a: makeUnionType('', [
          makeObjectType('', {
            a: makeUnionType('', ['a']),
          }),
          makeObjectType('', {
            a: makeUnionType('', ['b']),
          }),
        ]),
      }),
    ],
    true,
  ],
  [
    [
      // `{ a: 'a' } | { a: 'b', b: 'c' }` is assignable to `{ a: 'a' | 'b' }`
      makeUnionType('', [
        makeObjectType('', { a: makeUnionType('', ['a']) }),
        makeObjectType('', {
          a: makeUnionType('', ['b']),
          b: makeUnionType('', ['c']),
        }),
      ]),
      makeObjectType('', {
        a: makeUnionType('', ['a', 'b']),
      }),
    ],
    true,
  ],
  [
    [
      // `{ a: 'a' | 'b' } | 'c'` is assignable to `{ a: 'a' } | { a: 'b' } | 'c'`
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a', 'b']),
        }),
        'c',
      ]),
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
        }),
        makeObjectType('', {
          a: makeUnionType('', ['b']),
        }),
        'c',
      ]),
    ],
    true,
  ],
  [
    [
      // `{ a: 'a' | 'b' } | { b: 'a' | 'b' }` is assignable to `{ a: 'a' } | { a: 'b' } | { b: 'a' } | { b: 'b' }`
      makeObjectType('', {
        a: makeUnionType('', ['a', 'b']),
        b: makeUnionType('', ['a', 'b']),
      }),
      makeUnionType('', [
        makeObjectType('', { a: makeUnionType('', ['a']) }),
        makeObjectType('', { a: makeUnionType('', ['b']) }),
        makeObjectType('', { b: makeUnionType('', ['a']) }),
        makeObjectType('', { b: makeUnionType('', ['b']) }),
      ]),
    ],
    true,
  ],
  [
    [
      // `{ a: 'a' } | { a: 'b' } | { b: 'a' } | { b: 'b' }` is assignable to `{ a: 'a' | 'b' } | { b: 'a' | 'b' }`
      makeUnionType('', [
        makeObjectType('', { a: makeUnionType('', ['a']) }),
        makeObjectType('', { a: makeUnionType('', ['b']) }),
        makeObjectType('', { b: makeUnionType('', ['a']) }),
        makeObjectType('', { b: makeUnionType('', ['b']) }),
      ]),
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a', 'b']),
        }),
        makeObjectType('', {
          b: makeUnionType('', ['a', 'b']),
        }),
      ]),
    ],
    true,
  ],
  [
    [
      makeFunctionType('', { parameter: something, return: something }),
      makeFunctionType('', { parameter: something, return: something }),
    ],
    true,
  ],
  [
    [
      makeFunctionType('', {
        parameter: makeUnionType('', ['a']),
        return: makeUnionType('', ['a']),
      }),
      makeFunctionType('', {
        parameter: makeUnionType('', ['a']),
        return: makeUnionType('', ['a']),
      }),
    ],
    true,
  ],
  [
    [
      makeFunctionType('', {
        parameter: makeUnionType('', ['a', 'b', 'c']),
        return: makeUnionType('', ['d', 'e']),
      }),
      makeFunctionType('', {
        parameter: makeUnionType('', ['a', 'b']),
        return: makeUnionType('', ['d', 'e', 'f']),
      }),
    ],
    true,
  ],
  [
    [
      makeFunctionType('', {
        parameter: makeUnionType('', ['a']),
        return: makeUnionType('', ['a']),
      }),
      makeFunctionType('', { parameter: nothing, return: something }),
    ],
    true,
  ],
  [
    [
      makeFunctionType('', { parameter: something, return: nothing }),
      makeFunctionType('', { parameter: nothing, return: something }),
    ],
    true,
  ],
  [
    [
      // `string => 'a' | string => 'b'` is assignable to `'a' => 'a' | 'b'`
      makeUnionType('', [
        makeFunctionType('', {
          parameter: string,
          return: makeUnionType('', ['a']),
        }),
        makeFunctionType('', {
          parameter: string,
          return: makeUnionType('', ['b']),
        }),
      ]),
      makeFunctionType('', {
        parameter: makeUnionType('', ['a']),
        return: makeUnionType('', ['a', 'b']),
      }),
    ],
    true,
  ],
  [
    [
      makeFunctionType('', {
        parameter: makeUnionType('', ['a']),
        return: makeUnionType('', ['a']),
      }),
      makeUnionType('', [
        makeFunctionType('', {
          parameter: makeUnionType('', ['a']),
          return: makeUnionType('', ['a']),
        }),
        makeFunctionType('', {
          parameter: makeUnionType('', ['b']),
          return: makeUnionType('', ['b']),
        }),
      ]),
    ],
    true,
  ],
  // TODO: improve assignability checks for unions of objects to make this test case pass:
  // [
  //   [
  //     // `{ a: 'a' | 'b', b: 'c' }` is assignable to `{ a: 'a' } | { a: 'b', b: 'c' }`
  //     makeObjectType('', {
  //       a: makeUnionType('', ['a', 'b']),
  //       b: makeUnionType('', ['c']),
  //     }),
  //     makeUnionType('', [
  //       makeObjectType('', { a: makeUnionType('', ['a']) }),
  //       makeObjectType('', {
  //         a: makeUnionType('', ['b']),
  //         b: makeUnionType('', ['c']),
  //       }),
  //     ]),
  //   ],
  //   true,
  // ],
])

typeAssignabilitySuite('custom types (not assignable)', [
  [
    [makeUnionType('', ['a', 'b', 'c']), makeUnionType('', ['b', 'c', 'd'])],
    false,
  ],
  [
    [
      makeObjectType('', {
        a: string,
        b: object,
      }),
      makeObjectType('', {
        a: string,
        b: object,
        c: boolean, // required property in target not present in source
      }),
    ],
    false,
  ],
  [
    [
      // `{ a: 'a' | 'b', b: 'a' | 'b' }` is not assignable to `{ a: 'a', b: 'a' } | { a: 'b', b: 'b' }`
      makeObjectType('', {
        a: makeUnionType('', ['a', 'b']),
        b: makeUnionType('', ['a', 'b']),
      }),
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
          b: makeUnionType('', ['a']),
        }),
        makeObjectType('', {
          a: makeUnionType('', ['b']),
          b: makeUnionType('', ['b']),
        }),
      ]),
    ],
    false,
  ],
  [
    [
      // `{ a: 'a', b: 'b' }` is not assignable to `{ a: 'a', b: 'z' } | { b: 'b', a: 'z' }`
      makeObjectType('', {
        a: makeUnionType('', ['a']),
        b: makeUnionType('', ['b']),
      }),
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
          b: makeUnionType('', ['z']),
        }),
        makeObjectType('', {
          a: makeUnionType('', ['z']),
          b: makeUnionType('', ['b']),
        }),
      ]),
    ],
    false,
  ],
  [
    [
      // `{ a: 'a' } | { a: 'b', b: 'c' }` is not assignable to `{ a: 'a' | 'b', b: 'c' }`
      makeUnionType('', [
        makeObjectType('', {
          a: makeUnionType('', ['a']),
        }),
        makeObjectType('', {
          a: makeUnionType('', ['b']),
          b: makeUnionType('', ['c']),
        }),
      ]),
      makeObjectType('', {
        a: makeUnionType('', ['a', 'b']),
        b: makeUnionType('', ['c']),
      }),
    ],
    false,
  ],
  [
    [
      makeFunctionType('', { parameter: string, return: string }),
      makeFunctionType('', { parameter: object, return: object }),
    ],
    false,
  ],
  [
    [
      makeFunctionType('', { parameter: string, return: object }),
      makeFunctionType('', { parameter: object, return: object }),
    ],
    false,
  ],
  [
    [
      makeFunctionType('', { parameter: object, return: string }),
      makeFunctionType('', { parameter: object, return: object }),
    ],
    false,
  ],
  [
    [
      makeFunctionType('', { parameter: string, return: string }),
      makeFunctionType('', { parameter: something, return: something }),
    ],
    false,
  ],
  [
    [
      makeFunctionType('', { parameter: something, return: something }),
      makeFunctionType('', { parameter: string, return: string }),
    ],
    false,
  ],
  [
    [
      makeFunctionType('', { parameter: nothing, return: something }),
      makeFunctionType('', { parameter: something, return: nothing }),
    ],
    false,
  ],
  [
    [
      // `'a' => 'a' | 'b' => 'b'` is not assignable to `'a' | 'b' => 'a' | 'b'`
      // (a value of the former may only be able to handle `'a'` as an argument)
      makeUnionType('', [
        makeFunctionType('', {
          parameter: makeUnionType('', ['a']),
          return: makeUnionType('', ['a']),
        }),
        makeFunctionType('', {
          parameter: makeUnionType('', ['b']),
          return: makeUnionType('', ['b']),
        }),
      ]),
      makeFunctionType('', {
        parameter: makeUnionType('', ['a', 'b']),
        return: makeUnionType('', ['a', 'b']),
      }),
    ],
    false,
  ],
])

typeAssignabilitySuite('generic function types (assignable)', [
  [
    [
      // `a => a` is assignable to itself
      makeFunctionType('', {
        parameter: A,
        return: A,
      }),
      makeFunctionType('', {
        parameter: B,
        return: B,
      }),
    ],
    true,
  ],
  [
    [
      // `a => a` is assignable to `(a <: string) => a`
      makeFunctionType('', {
        parameter: A,
        return: A,
      }),
      makeFunctionType('', {
        parameter: extendsString,
        return: extendsString,
      }),
    ],
    true,
  ],
  [
    [
      // `a => a` is assignable to `string => string`
      makeFunctionType('', {
        parameter: A,
        return: A,
      }),
      makeFunctionType('', {
        parameter: string,
        return: string,
      }),
    ],
    true,
  ],
  [
    [
      // `(a <: string) => a` is assignable to `string => something`
      makeFunctionType('', {
        parameter: extendsString,
        return: extendsString,
      }),
      makeFunctionType('', {
        parameter: string,
        return: something,
      }),
    ],
    true,
  ],
  [
    [
      // `(a <: string) => { a: a }` is assignable to `string => something`
      makeFunctionType('', {
        parameter: extendsString,
        return: makeObjectType('', { a: extendsString }),
      }),
      makeFunctionType('', {
        parameter: string,
        return: something,
      }),
    ],
    true,
  ],
  [
    [
      // `a => { a: a, b: string }` is assignable to `(a <: string) => { a: a }`
      makeFunctionType('', {
        parameter: A,
        return: makeObjectType('', {
          a: A,
          b: string,
        }),
      }),
      makeFunctionType('', {
        parameter: extendsString,
        return: makeObjectType('', { a: extendsString }),
      }),
    ],
    true,
  ],
  [
    [
      // `(a <: string) => { a: a }` is assignable to `string => { a: string }`
      makeFunctionType('', {
        parameter: extendsString,
        return: makeObjectType('', { a: extendsString }),
      }),
      makeFunctionType('', {
        parameter: string,
        return: makeObjectType('', { a: string }),
      }),
    ],
    true,
  ],
  [
    [
      // `{ a: a } => a` is assignable to `{ a: (a <: string) } => a`
      makeFunctionType('', {
        parameter: makeObjectType('', {
          a: A,
        }),
        return: A,
      }),
      makeFunctionType('', {
        parameter: makeObjectType('', {
          a: extendsString,
        }),
        return: extendsString,
      }),
    ],
    true,
  ],
  [
    [
      // `{ a: a } => { b: a }` is assignable to `{ a: (a <: string) } => { b: a }`
      makeFunctionType('', {
        parameter: makeObjectType('', {
          a: A,
        }),
        return: makeObjectType('', {
          b: A,
        }),
      }),
      makeFunctionType('', {
        parameter: makeObjectType('', {
          a: extendsString,
        }),
        return: makeObjectType('', {
          b: extendsString,
        }),
      }),
    ],
    true,
  ],
  [
    [
      // `((a <: string) | object) => (a | "z")` is assignable to `(a <: ("a" | "b")) => (a | "y" | "z")`
      makeFunctionType('', {
        parameter: makeUnionType('', [extendsString, object]),
        return: makeUnionType('', [extendsString, 'z']),
      }),
      makeFunctionType('', {
        parameter: extendsUnionOfAtoms,
        return: makeUnionType('', [extendsUnionOfAtoms, 'y', 'z']),
      }),
    ],
    true,
  ],
  [
    [
      // `(a <: string => something) => a` is assignable to `(b => string) => b`
      makeFunctionType('', {
        parameter: extendsFunctionFromStringToValue,
        return: extendsFunctionFromStringToValue,
      }),
      makeFunctionType('', {
        parameter: extendsFunctionFromValueToString,
        return: extendsFunctionFromValueToString,
      }),
    ],
    true,
  ],

  [
    [
      // `(a <: (string => something)) => a` is assignable to `(something => something) => (something => something)`
      makeFunctionType('', {
        parameter: extendsFunctionFromStringToValue,
        return: extendsFunctionFromStringToValue,
      }),
      makeFunctionType('', {
        parameter: makeFunctionType('', {
          parameter: something,
          return: something,
        }),
        return: makeFunctionType('', {
          parameter: something,
          return: something,
        }),
      }),
    ],
    true,
  ],
  [
    [
      // `a => { 0: a, 1: a }` is assignable to `(a <: string) => { 0: a, 1: string }`
      makeFunctionType('', {
        parameter: A,
        return: makeObjectType('', {
          0: A,
          1: A,
        }),
      }),
      makeFunctionType('', {
        parameter: extendsString,
        return: makeObjectType('', {
          0: extendsString,
          1: string,
        }),
      }),
    ],
    true,
  ],
  [
    [
      // `{ 0: a, 1: b } => { 0: b, 1: a }` is assignable to `{ 0: a, 1: b } => { 0: b, 1: a }`
      makeFunctionType('', {
        parameter: makeObjectType('', {
          0: A,
          1: B,
        }),
        return: makeObjectType('', {
          0: B,
          1: A,
        }),
      }),
      makeFunctionType('', {
        parameter: makeObjectType('', {
          0: C,
          1: D,
        }),
        return: makeObjectType('', {
          0: D,
          1: C,
        }),
      }),
    ],
    true,
  ],
  [
    [
      // `{ 0: a, 1: b } => { 0: b, 1: a }` is assignable to `{ 0: (a <: string), 1: (b <: "a") } => { 0: b, 1: a }`
      makeFunctionType('', {
        parameter: makeObjectType('', {
          0: A,
          1: B,
        }),
        return: makeObjectType('', {
          0: B,
          1: A,
        }),
      }),
      makeFunctionType('', {
        parameter: makeObjectType('', {
          0: extendsString,
          1: extendsAtom,
        }),
        return: makeObjectType('', {
          0: extendsAtom,
          1: extendsString,
        }),
      }),
    ],
    true,
  ],
  [
    [
      // `{ 0: a, 1: b } => { 0: b, 1: a }` is assignable to `{ 0: a, 1: (b <: a) } => { 0: b, 1: a }`
      makeFunctionType('', {
        parameter: makeObjectType('', {
          0: B,
          1: C,
        }),
        return: makeObjectType('', {
          0: C,
          1: B,
        }),
      }),
      makeFunctionType('', {
        parameter: makeObjectType('', {
          0: A,
          1: extendsA,
        }),
        return: makeObjectType('', {
          0: extendsA,
          1: A,
        }),
      }),
    ],
    true,
  ],
  [
    [
      // `{ a: a, b: b, c: string | b } => { b: a, a: b, c: a }` is assignable to `{ a: (a <: string), b: (b <: a), c: b } => { b: a, a: b | a, c: string }`
      makeFunctionType('', {
        parameter: makeObjectType('', {
          a: A,
          b: B,
          c: makeUnionType('', [string, B]),
        }),
        return: makeObjectType('', {
          b: A,
          a: B,
          c: A,
        }),
      }),
      makeFunctionType('', {
        parameter: makeObjectType('', {
          a: extendsString,
          b: extendsExtendsString,
          c: extendsExtendsString,
        }),
        return: makeObjectType('', {
          b: extendsString,
          a: makeUnionType('', [extendsString, extendsExtendsString]),
          c: string,
        }),
      }),
    ],
    true,
  ],
])

typeAssignabilitySuite('generic function types (not assignable)', [
  [
    [
      //  `(a <: string) => a` is not assignable to `object => object`
      makeFunctionType('', {
        parameter: extendsString,
        return: extendsString,
      }),
      makeFunctionType('', {
        parameter: object,
        return: object,
      }),
    ],
    false,
  ],
  [
    [
      // `(a <: 'a') => a` is not assignable to `string => string`
      makeFunctionType('', {
        parameter: extendsAtom,
        return: extendsAtom,
      }),
      makeFunctionType('', {
        parameter: string,
        return: string,
      }),
    ],
    false,
  ],
  [
    [
      // `(a <: string) => a` is not assignable to `a => a`
      makeFunctionType('', {
        parameter: extendsString,
        return: extendsString,
      }),
      makeFunctionType('', {
        parameter: A,
        return: A,
      }),
    ],
    false,
  ],
  [
    [
      // `a => a` is not assignable to `something => string`
      makeFunctionType('', {
        parameter: A,
        return: A,
      }),
      makeFunctionType('', {
        parameter: something,
        return: string,
      }),
    ],
    false,
  ],
  [
    [
      // `a => { a: a }` is not assignable to `a => { b: a }`
      makeFunctionType('', {
        parameter: A,
        return: makeObjectType('', { a: A }),
      }),
      makeFunctionType('', {
        parameter: A,
        return: makeObjectType('', { b: A }),
      }),
    ],
    false,
  ],
  [
    [
      // `((a <: string) | object) => (a | "z")` is not assignable to `(a <: string) => a`
      makeFunctionType('', {
        parameter: makeUnionType('', [extendsString, object]),
        return: makeUnionType('', [extendsString, 'z']),
      }),
      makeFunctionType('', {
        parameter: extendsString,
        return: extendsString,
      }),
    ],
    false,
  ],
  [
    [
      // `{ 0: a, 1: (b <: a) } => { 0: b, 1: a }` is not assignable to `{ 0: a, 1: b } => { 0: b, 1: a }`
      makeFunctionType('', {
        parameter: makeObjectType('', {
          0: A,
          1: extendsA,
        }),
        return: makeObjectType('', {
          0: extendsA,
          1: A,
        }),
      }),
      makeFunctionType('', {
        parameter: makeObjectType('', {
          0: A,
          1: B,
        }),
        return: makeObjectType('', {
          0: B,
          1: A,
        }),
      }),
    ],
    false,
  ],
  [
    [
      // `(a <: something => string) => a` is not assignable to `(b <: string => something) => b`
      makeFunctionType('', {
        parameter: extendsFunctionFromValueToString,
        return: extendsFunctionFromValueToString,
      }),
      makeFunctionType('', {
        parameter: extendsFunctionFromStringToValue,
        return: extendsFunctionFromStringToValue,
      }),
    ],
    false,
  ],
  [
    [
      // `a => a` is not assignable to `(something => something) => string
      makeFunctionType('', {
        parameter: A,
        return: A,
      }),
      makeFunctionType('', {
        parameter: makeFunctionType('', {
          parameter: something,
          return: something,
        }),
        return: string,
      }),
    ],
    false,
  ],
  [
    [
      // `{ a: a } => a` is not assignable to `{ b: a } => a`
      makeFunctionType('', {
        parameter: makeObjectType('', {
          a: A,
        }),
        return: A,
      }),
      makeFunctionType('', {
        parameter: makeObjectType('', {
          b: A,
        }),
        return: A,
      }),
    ],
    false,
  ],
  [
    [
      // `a => { a: a }` is not assignable to `a => { b: a }`
      makeFunctionType('', {
        parameter: A,
        return: makeObjectType('', {
          a: A,
        }),
      }),
      makeFunctionType('', {
        parameter: A,
        return: makeObjectType('', {
          b: A,
        }),
      }),
    ],
    false,
  ],
])
