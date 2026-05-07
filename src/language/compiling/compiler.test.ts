import either, { type Either } from '@matt.kantor/either'
import assert from 'node:assert'
import { withPhantomData } from '../../phantom-data.js'
import { testCases } from '../../test-utilities.test.js'
import type { ElaborationError } from '../errors.js'
import { type Atom, type Molecule } from '../parsing.js'
import { parse } from '../parsing/parser.js'
import type { Output } from '../semantics.js'
import { compile } from './compiler.js'

const success = (
  expectedOutput: Atom | Molecule,
): Either<ElaborationError, Output> =>
  either.makeRight(withPhantomData<never>()(expectedOutput))

testCases(compile, input => `compiling \`${JSON.stringify(input)}\``)(
  'compiler',
  [
    ['Hello, world!', success('Hello, world!')],
    [
      {
        true1: true,
        true2: [
          '@apply',
          [['@index', [['@lookup', ['boolean']], ['not']]], false],
        ],
        false1: 'false',
        false2: [
          '@apply',
          [['@index', [['@lookup', ['boolean']], ['is']]], 'not a boolean'],
        ],
      },
      success({
        true1: 'true',
        true2: 'true',
        false1: 'false',
        false2: 'false',
      }),
    ],
    [
      ['@runtime', [['@lookup', ['identity']]]],
      success({
        0: '@runtime',
        1: { function: { 0: '@lookup', 1: { key: 'identity' } } },
      }),
    ],
    [
      [
        '@runtime',
        [
          [
            '@apply',
            [
              ['@lookup', ['identity']],
              ['@lookup', ['identity']],
            ],
          ],
        ],
      ],
      success({
        0: '@runtime',
        1: { function: { 0: '@lookup', 1: { key: 'identity' } } },
      }),
    ],
    [[['@lookup', ['compose']]], output => assert(either.isLeft(output))],
    [
      ['@runtime', [['@index', [['@lookup', ['boolean']], ['not']]]]],
      output => {
        assert(either.isLeft(output))
        assert(output.value.kind === 'typeMismatch')
      },
    ],
    [
      [
        '@runtime',
        [
          [
            '@apply',
            [
              ['@lookup', ['identity']],
              ['@index', [['@lookup', ['boolean']], ['not']]],
            ],
          ],
        ],
      ],
      output => {
        assert(either.isLeft(output))
        assert(output.value.kind === 'typeMismatch')
      },
    ],
    [
      [
        '@runtime',
        [
          [
            '@apply',
            [
              [
                '@apply',
                [
                  ['@lookup', ['flow']],
                  ['@lookup', ['identity']],
                ],
              ],
              ['@lookup', ['identity']],
            ],
          ],
        ],
      ],
      success({
        0: '@runtime',
        1: {
          function: {
            0: '@apply',
            1: {
              function: {
                0: '@apply',
                1: {
                  function: { 0: '@lookup', 1: { key: 'flow' } },
                  argument: { 0: '@lookup', 1: { key: 'identity' } },
                },
              },
              argument: { 0: '@lookup', 1: { key: 'identity' } },
            },
          },
        },
      }),
    ],
    [
      ['@runtime', [['@index', [['@lookup', ['boolean']], ['not']]]]],
      output => {
        assert(either.isLeft(output))
        assert(output.value.kind === 'typeMismatch')
      },
    ],
    [
      {
        0: '@runtime',
        1: {
          function: {
            0: '@apply',
            1: {
              function: {
                0: '@index',
                1: {
                  object: { 0: '@lookup', 1: { key: 'object' } },
                  query: { 0: 'lookup' },
                },
              },
              argument: 'key which does not exist in runtime context',
            },
          },
        },
      },
      success({
        0: '@runtime',
        1: {
          function: {
            0: '@apply',
            1: {
              function: {
                0: '@index',
                1: {
                  object: { 0: '@lookup', 1: { key: 'object' } },
                  query: { 0: 'lookup' },
                },
              },
              argument: 'key which does not exist in runtime context',
            },
          },
        },
      }),
    ],
    [
      { a: ['@lookup', ['b']], b: ['@index', [[42], ['0']]] },
      success({ a: '42', b: '42' }),
    ],
  ],
)

const parseAndCompile = (input: string) =>
  either.flatMap(parse(input), (syntaxTree: Atom | Molecule) =>
    compile(syntaxTree),
  )

testCases(
  parseAndCompile,
  input => `parsing & compiling \`${JSON.stringify(input)}\``,
)('parser + compiler', [
  ['{ a: :b, b: :c, c: 42 }', success({ a: '42', b: '42', c: '42' })],

  [
    '{ a: false, b: { :a, a: true } }',
    success({ a: 'false', b: { 0: 'true', a: 'true' } }),
  ],

  ['{ a: :b, b: { 42 }.0 }', success({ a: '42', b: '42' })],

  ['{ a: :b, b: :identity(42) }', success({ a: '42', b: '42' })],

  ['{ a: @if { true, true, 42 }, :a }', success({ a: 'true', '0': 'true' })],

  [
    '{ a: @if { true, true, 42 }, b: :a, :b }',
    success({ a: 'true', b: 'true', '0': 'true' }),
  ],

  [
    '{ a: :identity(1), b: :identity(2), :a, :b }',
    success({ a: '1', b: '2', '0': '1', '1': '2' }),
  ],

  [
    '@runtime { _ => 42 ~ :integer.type }',
    success({
      '0': '@runtime',
      '1': {
        function: {
          '0': '@function',
          '1': { parameter: '_', body: '42' },
        },
      },
    }),
  ],

  [
    '@runtime { _ => { some_integer: 42, same_integer: :some_integer ~ :integer.type } }',
    success({
      '0': '@runtime',
      '1': {
        function: {
          '0': '@function',
          '1': {
            parameter: '_',
            body: { some_integer: '42', same_integer: '42' },
          },
        },
      },
    }),
  ],

  [
    '@runtime { context => :context.program.start_time ~ :atom.type }',
    success({
      '0': '@runtime',
      '1': {
        function: {
          '0': '@function',
          '1': {
            parameter: 'context',
            body: {
              '0': '@index',
              '1': {
                object: {
                  '0': '@lookup',
                  '1': { key: 'context' },
                },
                query: {
                  '0': 'program',
                  '1': 'start_time',
                },
              },
            },
          },
        },
      },
    }),
  ],

  [
    '@runtime { _ => 42 ~ :boolean.type }',
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    '@runtime { context => :context.program.start_time ~ :object.type }',
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    '@runtime { context => { a: :context.program.start_time, :a ~ :atom.type } }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '@runtime { context => :context.program.start_time } ~ :atom.type',
    success({
      '0': '@runtime',
      '1': {
        function: {
          '0': '@function',
          '1': {
            parameter: 'context',
            body: {
              '0': '@index',
              '1': {
                object: {
                  '0': '@lookup',
                  '1': { key: 'context' },
                },
                query: {
                  '0': 'program',
                  '1': 'start_time',
                },
              },
            },
          },
        },
      },
    }),
  ],

  [
    '@runtime { context => :context.program.start_time } ~ :atom.type',
    success({
      '0': '@runtime',
      '1': {
        function: {
          '0': '@function',
          '1': {
            parameter: 'context',
            body: {
              '0': '@index',
              '1': {
                object: {
                  '0': '@lookup',
                  '1': { key: 'context' },
                },
                query: {
                  '0': 'program',
                  '1': 'start_time',
                },
              },
            },
          },
        },
      },
    }),
  ],

  [
    '@runtime { context => { a: :context.program.start_time } ~ { a: :atom.type } }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '{ a: @runtime { context => :context.program.start_time }, :a ~ :atom.type }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '@runtime { context => { a: :context.program.start_time, b: :a, :b ~ :atom.type } }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '{ a: @runtime { context => :context.program.start_time }, b: :a, :b ~ :atom.type }',
    result => {
      assert(either.isRight(result))
    },
  ],

  ['@if { true, true, 42 } ~ :boolean.type', success('true')],

  [
    '{ a: 42, b: :a, :b ~ :integer.type }',
    success({ a: '42', b: '42', '0': '42' }),
  ],

  [
    '{ a: 42, (_ => :a)(_) ~ :integer.type }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '{ a: 42, b: _ => :a, c: :b(_) ~ :integer.type }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '{ a: 42, b: _ => :a, :b(_) ~ :integer.type }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '{ a: 42, b: _ => :a }.b(_) ~ :integer.type',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '{ a: _ => 42, b: :a, :b(_) ~ :integer.type }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '(_ => 42) ~ (:something.type ~> :integer.type)',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '(_ => 42) ~ (:something.type ~> :boolean.type)',
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    '{ a: 42, f: _ => :a, :f ~ (:something.type ~> :integer.type) }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '{ a: @if { true, true, 42 }, :a ~ :boolean.type }',
    success({ a: 'true', '0': 'true' }),
  ],

  [
    '{ a: true, b: 42, @if { true, :a, :b } ~ :boolean.type }',
    success({ a: 'true', b: '42', '0': 'true' }),
  ],

  [
    '@if { @runtime { _ => true }, 1, "not an integer" } ~ :integer.type',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    `@if {
      @runtime { context =>
        :context.program.start_time atom.equals "arbitrary atom"
      }
      then: 1
      else: "not an integer"
    } ~ (1 | "not an integer")`,
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    `:boolean.not("not a boolean")`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `:boolean.not(@runtime { _ => "not a boolean" })`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `@runtime { _ => :integer.is_greater_than(1)(2) } ~ :boolean.type`,
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    `@runtime { _ => 1 |> :identity } ~ 1`,
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '{ f: :identity, :f(1) ~ 1 }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    '{ f: :identity >> :identity, :f(1) ~ 1 }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    ':flow(@runtime { _ => "not a function" })',
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    // `:f` isn't necessarily a function, e.g. `:oops("not a function")` is a
    // legal call.
    '{ oops: f => :f(42) }',
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'invalidExpression')
    },
  ],

  [
    '{ f: a => :a, :f(1) ~ 1 }',
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    `@runtime { context => (a => :a)(:context.program.start_time) } ~ :atom.type`,
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    `@runtime { context => (a => :a)(:context.program.start_time) } ~ :integer.type`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `@runtime { context => (a => :context.log(:a))(1) } ~ 1`,
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    `@runtime { context => (a => :context.log(:a))(1) } ~ 2`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `{
      integer_identity: @function {
        parameter: { a: :integer.type }
        body: :a
      }
      :integer_identity("not an integer")
    }`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `a => :a ~ :boolean.type`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    // `:a` is a lookup of an unannotated parameter, so its inferred type is an
    // unconstrained type parameter, which is not assignable to `:integer.type`.
    // If the language eventually gains Hindley–Milner-style inference this
    // program may become valid (and this test case will need updating).
    `(a => :integer.add(1)(:a))(1)`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `@if {
      @runtime { context =>
        :context.program.start_time atom.equals "arbitrary atom"
      }
      then: 42
      else: @panic
    } ~ :integer.type`,
    result => {
      assert(either.isRight(result))
    },
  ],

  [
    `@if { @runtime { _ => true }, :boolean.not("not a boolean"), oops }`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `@if { @runtime { _ => true }, "not a boolean" ~ :boolean.type, oops }`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `{ a: {}, :a.non_existent_property }`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `a => :a.non_existent_property`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `{ a: {}, @if { @runtime { _ => true }, :a.non_existent_property, oops } }`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `{ a: { b: {} }, :a.b.non_existent_property }`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `{ a: "not an object", :a.non_existent_property }`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `{ a: { b: 1 }, :a.non_existent_property.another_non_existent_property }`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `{ a: :identity, :a.non_existent_property }`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `@if { @runtime { _ => "not a boolean" }, a, b }`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [
    `@runtime { (context: "not the correct type") => {} }`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],

  [`((a: :integer.type) => :a)(42) ~ 42`, success('42')],

  [
    `{
      swap: (parameters: { :something.type, :something.type }) =>
        { :parameters.1, :parameters.0 }
    }.swap({ a, b }) ~ { b, a }`,
    result => {
      assert(either.isRight(result))
    },
  ],
])
