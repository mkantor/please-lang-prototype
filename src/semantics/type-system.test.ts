import { testCases } from '../test-utilities.test.js'
import {
  boolean,
  nothing,
  nullType,
  object,
  string,
  value,
} from './type-system/prelude-types.js'
import { isAssignable } from './type-system/subtyping.js'
import {
  makeObjectType,
  makeUnionType,
  showType,
  type Type,
} from './type-system/type-formats.js'

const typeAssignabilitySuite = testCases(
  ([source, target]: [source: Type, target: Type]) =>
    isAssignable({ source, target }),
  ([source, target]) =>
    `checking assignability of \`${showType(source)}\` to \`${showType(
      target,
    )}\``,
)

typeAssignabilitySuite('prelude types', [
  [[nothing, nothing], true],
  [[nullType, nullType], true],
  [[boolean, boolean], true],
  [[string, string], true],
  [[object, object], true],
  [[value, value], true],
  [[nothing, nullType], true],
  [[nothing, string], true],
  [[nothing, object], true],
  [[nothing, value], true],
  [[nullType, string], true],
  [[nullType, value], true],
  [[boolean, string], true],
  [[boolean, value], true],
  [[string, value], true],
  [[object, value], true],
  [[nullType, nothing], false],
  [[nullType, boolean], false],
  [[nullType, object], false],
  [[boolean, nothing], false],
  [[boolean, nullType], false],
  [[boolean, object], false],
  [[string, nothing], false],
  [[string, nullType], false],
  [[string, boolean], false],
  [[string, object], false],
  [[object, nothing], false],
  [[object, nullType], false],
  [[object, boolean], false],
  [[object, string], false],
  [[value, nothing], false],
  [[value, nullType], false],
  [[value, boolean], false],
  [[value, string], false],
  [[value, object], false],
])

typeAssignabilitySuite('custom types', [
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
])
