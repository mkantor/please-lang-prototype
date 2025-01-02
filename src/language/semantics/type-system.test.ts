import { testCases } from '../../test-utilities.test.js'
import {
  atom,
  boolean,
  functionType,
  integer,
  naturalNumber,
  nothing,
  nullType,
  object,
  something,
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

const extendsAnyAtom = makeTypeParameter('z', {
  assignableTo: atom,
})
const extendsSpecificAtom = makeTypeParameter('y', {
  assignableTo: makeUnionType('', ['a']),
})
const extendsUnionOfAtoms = makeTypeParameter('x', {
  assignableTo: makeUnionType('', ['a', 'b']),
})
const extendsA = makeTypeParameter('w', {
  assignableTo: A,
})
const extendsFunctionFromAtomToValue = makeTypeParameter('i', {
  assignableTo: makeFunctionType('', { parameter: atom, return: something }),
})
const extendsFunctionFromValueToAtom = makeTypeParameter('v', {
  assignableTo: makeFunctionType('', { parameter: something, return: atom }),
})
const extendsExtendsAnyAtom = makeTypeParameter('u', {
  assignableTo: extendsAnyAtom,
})

testCases(
  (type: UnionType) => showType(simplifyUnionType(type)),
  type => `simplifying type \`${showType(type)}\``,
)('simplifying union types', [
  [
    makeUnionType('', [
      'a',
      atom,
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
    '(atom | { a: ("a" | "b" | "c") })',
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
  [[naturalNumber, naturalNumber], true],
  [[integer, integer], true],
  [[atom, atom], true],
  [[object, object], true],
  [[functionType, functionType], true],
  [[something, something], true],
  [[nothing, nullType], true],
  [[nothing, naturalNumber], true],
  [[nothing, atom], true],
  [[nothing, object], true],
  [[nothing, functionType], true],
  [[nothing, something], true],
  [[nullType, atom], true],
  [[nullType, something], true],
  [[boolean, atom], true],
  [[boolean, something], true],
  [[naturalNumber, integer], true],
  [[naturalNumber, atom], true],
  [[naturalNumber, something], true],
  [[integer, atom], true],
  [[integer, something], true],
  [[atom, something], true],
  [[object, something], true],
  [[functionType, something], true],
])

typeAssignabilitySuite('prelude types (not assignable)', [
  [[nullType, nothing], false],
  [[nullType, boolean], false],
  [[nullType, naturalNumber], false],
  [[nullType, integer], false],
  [[nullType, object], false],
  [[nullType, functionType], false],
  [[boolean, nothing], false],
  [[boolean, nullType], false],
  [[boolean, naturalNumber], false],
  [[boolean, integer], false],
  [[boolean, object], false],
  [[boolean, functionType], false],
  [[naturalNumber, nothing], false],
  [[naturalNumber, nullType], false],
  [[naturalNumber, boolean], false],
  [[naturalNumber, object], false],
  [[naturalNumber, functionType], false],
  [[integer, nothing], false],
  [[integer, nullType], false],
  [[integer, boolean], false],
  [[integer, naturalNumber], false],
  [[integer, object], false],
  [[integer, functionType], false],
  [[atom, nothing], false],
  [[atom, nullType], false],
  [[atom, boolean], false],
  [[atom, naturalNumber], false],
  [[atom, integer], false],
  [[atom, object], false],
  [[atom, functionType], false],
  [[object, nothing], false],
  [[object, nullType], false],
  [[object, boolean], false],
  [[object, naturalNumber], false],
  [[object, integer], false],
  [[object, atom], false],
  [[object, functionType], false],
  [[functionType, nothing], false],
  [[functionType, nullType], false],
  [[functionType, boolean], false],
  [[functionType, naturalNumber], false],
  [[functionType, integer], false],
  [[functionType, atom], false],
  [[functionType, object], false],
  [[something, nothing], false],
  [[something, nullType], false],
  [[something, boolean], false],
  [[something, naturalNumber], false],
  [[something, integer], false],
  [[something, atom], false],
  [[something, object], false],
  [[something, functionType], false],
])

typeAssignabilitySuite('custom types (assignable)', [
  [[makeUnionType('', ['a']), makeUnionType('', ['a', 'b'])], true],
  [[makeUnionType('', ['a']), atom], true],
  [[makeUnionType('', ['a', 'b']), atom], true],
  [[makeUnionType('', ['a']), makeUnionType('', [atom, 'b'])], true],
  [[makeUnionType('', ['1']), naturalNumber], true],
  [[makeUnionType('', ['0', '1']), naturalNumber], true],
  [
    [
      makeUnionType('', ['9876543210']),
      makeUnionType('', [naturalNumber, 'not a number']),
    ],
    true,
  ],
  [[makeUnionType('', ['0', '-1']), integer], true],
  [
    [
      makeObjectType('', {
        a: makeUnionType('', ['a']),
        b: object,
      }),
      makeObjectType('', {
        a: atom,
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
        a: atom,
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
      // `atom => 'a' | atom => 'b'` is assignable to `'a' => 'a' | 'b'`
      makeUnionType('', [
        makeFunctionType('', {
          parameter: atom,
          return: makeUnionType('', ['a']),
        }),
        makeFunctionType('', {
          parameter: atom,
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
  [[makeUnionType('', ['-1']), naturalNumber], false],
  [[makeUnionType('', ['-0']), integer], false],
  [
    [
      makeObjectType('', {
        a: atom,
        b: object,
      }),
      makeObjectType('', {
        a: atom,
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
      makeFunctionType('', { parameter: atom, return: atom }),
      makeFunctionType('', { parameter: object, return: object }),
    ],
    false,
  ],
  [
    [
      makeFunctionType('', { parameter: atom, return: object }),
      makeFunctionType('', { parameter: object, return: object }),
    ],
    false,
  ],
  [
    [
      makeFunctionType('', { parameter: object, return: atom }),
      makeFunctionType('', { parameter: object, return: object }),
    ],
    false,
  ],
  [
    [
      makeFunctionType('', { parameter: atom, return: atom }),
      makeFunctionType('', { parameter: something, return: something }),
    ],
    false,
  ],
  [
    [
      makeFunctionType('', { parameter: something, return: something }),
      makeFunctionType('', { parameter: atom, return: atom }),
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
      // `a => a` is assignable to `(a <: atom) => a`
      makeFunctionType('', {
        parameter: A,
        return: A,
      }),
      makeFunctionType('', {
        parameter: extendsAnyAtom,
        return: extendsAnyAtom,
      }),
    ],
    true,
  ],
  [
    [
      // `a => a` is assignable to `atom => atom`
      makeFunctionType('', {
        parameter: A,
        return: A,
      }),
      makeFunctionType('', {
        parameter: atom,
        return: atom,
      }),
    ],
    true,
  ],
  [
    [
      // `(a <: atom) => a` is assignable to `atom => something`
      makeFunctionType('', {
        parameter: extendsAnyAtom,
        return: extendsAnyAtom,
      }),
      makeFunctionType('', {
        parameter: atom,
        return: something,
      }),
    ],
    true,
  ],
  [
    [
      // `(a <: atom) => { a: a }` is assignable to `atom => something`
      makeFunctionType('', {
        parameter: extendsAnyAtom,
        return: makeObjectType('', { a: extendsAnyAtom }),
      }),
      makeFunctionType('', {
        parameter: atom,
        return: something,
      }),
    ],
    true,
  ],
  [
    [
      // `a => { a: a, b: atom }` is assignable to `(a <: atom) => { a: a }`
      makeFunctionType('', {
        parameter: A,
        return: makeObjectType('', {
          a: A,
          b: atom,
        }),
      }),
      makeFunctionType('', {
        parameter: extendsAnyAtom,
        return: makeObjectType('', { a: extendsAnyAtom }),
      }),
    ],
    true,
  ],
  [
    [
      // `(a <: atom) => { a: a }` is assignable to `atom => { a: atom }`
      makeFunctionType('', {
        parameter: extendsAnyAtom,
        return: makeObjectType('', { a: extendsAnyAtom }),
      }),
      makeFunctionType('', {
        parameter: atom,
        return: makeObjectType('', { a: atom }),
      }),
    ],
    true,
  ],
  [
    [
      // `{ a: a } => a` is assignable to `{ a: (a <: atom) } => a`
      makeFunctionType('', {
        parameter: makeObjectType('', {
          a: A,
        }),
        return: A,
      }),
      makeFunctionType('', {
        parameter: makeObjectType('', {
          a: extendsAnyAtom,
        }),
        return: extendsAnyAtom,
      }),
    ],
    true,
  ],
  [
    [
      // `{ a: a } => { b: a }` is assignable to `{ a: (a <: atom) } => { b: a }`
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
          a: extendsAnyAtom,
        }),
        return: makeObjectType('', {
          b: extendsAnyAtom,
        }),
      }),
    ],
    true,
  ],
  [
    [
      // `((a <: atom) | object) => (a | "z")` is assignable to `(a <: ("a" | "b")) => (a | "y" | "z")`
      makeFunctionType('', {
        parameter: makeUnionType('', [extendsAnyAtom, object]),
        return: makeUnionType('', [extendsAnyAtom, 'z']),
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
      // `(a <: atom => something) => a` is assignable to `(b => atom) => b`
      makeFunctionType('', {
        parameter: extendsFunctionFromAtomToValue,
        return: extendsFunctionFromAtomToValue,
      }),
      makeFunctionType('', {
        parameter: extendsFunctionFromValueToAtom,
        return: extendsFunctionFromValueToAtom,
      }),
    ],
    true,
  ],

  [
    [
      // `(a <: (atom => something)) => a` is assignable to `(something => something) => (something => something)`
      makeFunctionType('', {
        parameter: extendsFunctionFromAtomToValue,
        return: extendsFunctionFromAtomToValue,
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
      // `a => { 0: a, 1: a }` is assignable to `(a <: atom) => { 0: a, 1: atom }`
      makeFunctionType('', {
        parameter: A,
        return: makeObjectType('', {
          0: A,
          1: A,
        }),
      }),
      makeFunctionType('', {
        parameter: extendsAnyAtom,
        return: makeObjectType('', {
          0: extendsAnyAtom,
          1: atom,
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
      // `{ 0: a, 1: b } => { 0: b, 1: a }` is assignable to `{ 0: (a <: atom), 1: (b <: "a") } => { 0: b, 1: a }`
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
          0: extendsAnyAtom,
          1: extendsSpecificAtom,
        }),
        return: makeObjectType('', {
          0: extendsSpecificAtom,
          1: extendsAnyAtom,
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
      // `{ a: a, b: b, c: atom | b } => { b: a, a: b, c: a }` is assignable to `{ a: (a <: atom), b: (b <: a), c: b } => { b: a, a: b | a, c: atom }`
      makeFunctionType('', {
        parameter: makeObjectType('', {
          a: A,
          b: B,
          c: makeUnionType('', [atom, B]),
        }),
        return: makeObjectType('', {
          b: A,
          a: B,
          c: A,
        }),
      }),
      makeFunctionType('', {
        parameter: makeObjectType('', {
          a: extendsAnyAtom,
          b: extendsExtendsAnyAtom,
          c: extendsExtendsAnyAtom,
        }),
        return: makeObjectType('', {
          b: extendsAnyAtom,
          a: makeUnionType('', [extendsAnyAtom, extendsExtendsAnyAtom]),
          c: atom,
        }),
      }),
    ],
    true,
  ],
])

typeAssignabilitySuite('generic function types (not assignable)', [
  [
    [
      // `(a <: atom) => a` is not assignable to `object => object`
      makeFunctionType('', {
        parameter: extendsAnyAtom,
        return: extendsAnyAtom,
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
      // `(a <: 'a') => a` is not assignable to `atom => atom`
      makeFunctionType('', {
        parameter: extendsSpecificAtom,
        return: extendsSpecificAtom,
      }),
      makeFunctionType('', {
        parameter: atom,
        return: atom,
      }),
    ],
    false,
  ],
  [
    [
      // `(a <: atom) => a` is not assignable to `a => a`
      makeFunctionType('', {
        parameter: extendsAnyAtom,
        return: extendsAnyAtom,
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
      // `a => a` is not assignable to `something => atom`
      makeFunctionType('', {
        parameter: A,
        return: A,
      }),
      makeFunctionType('', {
        parameter: something,
        return: atom,
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
      // `((a <: atom) | object) => (a | "z")` is not assignable to `(a <: atom) => a`
      makeFunctionType('', {
        parameter: makeUnionType('', [extendsAnyAtom, object]),
        return: makeUnionType('', [extendsAnyAtom, 'z']),
      }),
      makeFunctionType('', {
        parameter: extendsAnyAtom,
        return: extendsAnyAtom,
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
      // `(a <: something => atom) => a` is not assignable to `(b <: atom => something) => b`
      makeFunctionType('', {
        parameter: extendsFunctionFromValueToAtom,
        return: extendsFunctionFromValueToAtom,
      }),
      makeFunctionType('', {
        parameter: extendsFunctionFromAtomToValue,
        return: extendsFunctionFromAtomToValue,
      }),
    ],
    false,
  ],
  [
    [
      // `a => a` is not assignable to `(something => something) => atom
      makeFunctionType('', {
        parameter: A,
        return: A,
      }),
      makeFunctionType('', {
        parameter: makeFunctionType('', {
          parameter: something,
          return: something,
        }),
        return: atom,
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
