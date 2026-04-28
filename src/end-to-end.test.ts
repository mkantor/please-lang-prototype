import either from '@matt.kantor/either'
import assert from 'node:assert'
import { compile } from './language/compiling.js'
import { parse } from './language/parsing/parser.js'
import { evaluate } from './language/runtime.js'
import {
  parseAndCompileAndRun,
  testCases,
  unparseAndRoundtrip,
  type ProgramResult,
} from './test-utilities.test.js'

const endToEnd = (input: string) => {
  const syntaxTree: ProgramResult = parse(input)
  const runtimeOutputFromRoundtrippingSyntaxTree = either.flatMap(
    syntaxTree,
    unparseAndRoundtrip,
  )

  const program: ProgramResult = either.flatMap(syntaxTree, compile)
  const runtimeOutputFromRoundtrippingProgram = either.flatMap(
    program,
    unparseAndRoundtrip,
  )

  const runtimeOutput: ProgramResult = either.flatMap(program, evaluate)

  // These errors could be stitched into the returned `Either`'s left, but
  // that'd lead to worse test reporting.
  assert.deepEqual(
    runtimeOutput,
    runtimeOutputFromRoundtrippingSyntaxTree,
    'Unexpected syntax tree roundtrip result',
  )
  assert.deepEqual(
    runtimeOutput,
    runtimeOutputFromRoundtrippingProgram,
    'Unexpected program roundtrip result',
  )

  return runtimeOutput
}

// These tests can't be fully-roundtripped because their output depends on
// runtime state.
testCases(parseAndCompileAndRun, code => code)('runtime-derived values', [
  [
    `@runtime { context => :identity(:context).program.start_time }`,
    output => {
      if (either.isLeft(output)) {
        assert.fail(output.value.message)
      }
      assert(typeof output.value === 'string')
    },
  ],
  [
    `{
      my_function: n => :n
      input: @runtime { _context => { tag: some, value: 42 } }
      output: :input match {
        none: _ => "missing value"
        some: input => @if {
          :natural_number.is(:input)
          then: :my_function(:input)
          else: "--input must be a natural number"
        }
      }
    }.output`,
    either.makeRight('42'),
  ],
  [
    `(a => {
      my_function: b => @if {
        :b > :a
        then: @panic "should not go down this branch"
        else: 2 + @if {
          :b > 1
          then: @panic "should not go down this branch either"
          else: 3
        }
      }
      return: :my_function(0)
    })(2).return`,
    either.makeRight('5'),
  ],
  [
    `{
      count: limit => {
        count_internal: state => @if {
          :state.current > :limit
          then: :state.output
          else: :count_internal({
            output: :state.output atom.append :state.current atom.append @if {
              :state.current > 1
              then: " (greater than one) "
              else: " (not greater than one) "
            }
            current: :state.current + 1
          })
        }
        return: :count_internal({ current: 0, output: "" })
      }.return
    }.count(2)`,
    either.makeRight(
      '0 (not greater than one) 1 (not greater than one) 2 (greater than one) ',
    ),
  ],
])

testCases(endToEnd, code => code)('end-to-end tests', [
  ['""', either.makeRight('')],
  ['{}', either.makeRight({})],
  ['hi', either.makeRight('hi')],
  ['1.1', either.makeRight('1.1')],
  ['{{{}}}', either.makeRight({ 0: { 0: {} } })],
  ['"hello world"', either.makeRight('hello world')],
  ['{foo:bar}', either.makeRight({ foo: 'bar' })],
  ['{hi}', either.makeRight({ 0: 'hi' })],
  ['{a,b,c}', either.makeRight({ 0: 'a', 1: 'b', 2: 'c' })],
  ['{,a,b,c,}', either.makeRight({ 0: 'a', 1: 'b', 2: 'c' })],
  ['{a,1:overwritten,c}', either.makeRight({ 0: 'a', 1: 'c' })],
  ['{overwritten,0:a,c}', either.makeRight({ 0: 'a', 1: 'c' })],
  ['@check {type:true, value:true}', either.makeRight('true')],
  [
    '@panic',
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'panic')
    },
  ],
  ['{a:A, b:{"@lookup", {a}}}', either.makeRight({ a: 'A', b: 'A' })],
  ['{a:A, {"@lookup", {a}}}', either.makeRight({ a: 'A', 0: 'A' })],
  ['{a:A, b: :a}', either.makeRight({ a: 'A', b: 'A' })],
  ['{a:A, :a}', either.makeRight({ a: 'A', 0: 'A' })],
  [
    '@runtime {_ => @panic}',
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'panic')
    },
  ],
  [
    'a => :a',
    either.makeRight({
      0: '@function',
      1: {
        parameter: 'a',
        body: { 0: '@lookup', 1: { key: 'a' } },
      },
    }),
  ],
  [
    '(a => :a)',
    either.makeRight({
      0: '@function',
      1: {
        parameter: 'a',
        body: { 0: '@lookup', 1: { key: 'a' } },
      },
    }),
  ],
  ['{ a: ({ A }) }', either.makeRight({ a: { 0: 'A' } })],
  ['{ a: ( A ) }', either.makeRight({ a: 'A' })],
  ['{ a: ("A A A") }', either.makeRight({ a: 'A A A' })],
  ['{ ("a"): A }', either.makeRight({ a: 'A' })],
  ['{ a: :(b), b: B }', either.makeRight({ a: 'B', b: 'B' })],
  ['{ a: :("b"), b: B }', either.makeRight({ a: 'B', b: 'B' })],
  ['{ (a: A), (b: B) }', either.makeRight({ a: 'A', b: 'B' })],
  ['( { ((a): :(b)), ( ( b ): B ) } )', either.makeRight({ a: 'B', b: 'B' })],
  ['{ (a: :(")")), (")": (B)) }', either.makeRight({ a: 'B', ')': 'B' })],
  [`/**/a/**/`, either.makeRight('a')],
  ['hello//world', either.makeRight('hello')],
  [`"hello//world"`, either.makeRight('hello//world')],
  [
    `/**/{/**/a:/**/b/**/,/**/c:/**/d/**/}/**/`,
    either.makeRight({ a: 'b', c: 'd' }),
  ],
  [
    `{
      // foo: bar
      "static data":"blah blah blah"
      "evaluated data": {
        0:"@runtime"
        1:{
          function:{
            0:"@apply"
            1:{
              function:{0:"@index", 1:{object:{0:"@lookup", 1:{key:object}}, query:{0:lookup}}}
              argument:"key which does not exist in runtime context"
            }
          }
        }
      }
    }`,
    either.makeRight({
      'static data': 'blah blah blah',
      'evaluated data': { tag: 'none', value: {} },
    }),
  ],
  ['(a => :a)(A)', either.makeRight('A')],
  ['{ a: (a => :a)(A) }', either.makeRight({ a: 'A' })],
  ['{ a: ( a => :a )( A ) }', either.makeRight({ a: 'A' })],
  ['(_ => B)(A)', either.makeRight('B')],
  ['{ success }.0', either.makeRight('success')],
  ['{ f: :identity }.f(success)', either.makeRight('success')],
  ['{ f: :identity }.f({ a: success }).a', either.makeRight('success')],
  [
    '{ f: :identity }.f({ g: :identity }).g({ a: success }).a',
    either.makeRight('success'),
  ],
  ['{ a: { b: success } }.a.b', either.makeRight('success')],
  [
    '{ a: { "b.c(d) e \\" {}": success } }.a."b.c(d) e \\" {}"',
    either.makeRight('success'),
  ],
  ['(a => { b: :a }.b)(success)', either.makeRight('success')],
  ['(a => { b: :a })(success).b', either.makeRight('success')],
  ['{ success }/**/./**/0', either.makeRight('success')],
  [
    `
      { a: { b: success } } // blah
        // blah
        .a // blah
        // blah
        .b // blah
    `,
    either.makeRight('success'),
  ],
  [
    `/**/(/**/a/**/=>/**/:a/**/)(/**/output/**/)/**/`,
    either.makeRight('output'),
  ],
  [':identity(output)', either.makeRight('output')],
  [
    '{ a: a => :a, b: :a(A) }',
    result => {
      if (either.isLeft(result)) {
        assert.fail(result.value.message)
      }
      assert(typeof result.value === 'object')
      assert.deepEqual(result.value['b'], 'A')
    },
  ],
  [':boolean.or(false)(false)', either.makeRight('false')],
  [':boolean.or(false)(true)', either.makeRight('true')],
  [':boolean.or(true)(false)', either.makeRight('true')],
  [':boolean.or(true)(true)', either.makeRight('true')],
  [':boolean.and(false)(false)', either.makeRight('false')],
  [':boolean.and(false)(true)', either.makeRight('false')],
  [':boolean.and(true)(false)', either.makeRight('false')],
  [':boolean.and(true)(true)', either.makeRight('true')],
  [':match({ a: A })({ tag: a, value: {} })', either.makeRight('A')],
  [':atom.prepend(a)(b)', either.makeRight('ab')],
  [
    `{
      :atom.equals(hello)(hello)
      :atom.equals("")("")
      :atom.equals(hello)(Hello)
      :atom.equals("1.0")("1.00")
    }`,
    either.makeRight({ 0: 'true', 1: 'true', 2: 'false', 3: 'false' }),
  ],
  [`:integer.add(1)(1)`, either.makeRight('2')],
  [
    `:integer.add(one)(juan)`,
    output => {
      assert(either.isLeft(output))
    },
  ],
  [`:integer.add(42)(-1)`, either.makeRight('41')],
  [`42 + -1`, either.makeRight('41')],
  [`:integer.subtract(-1)(-1)`, either.makeRight('0')],
  [`-1 - -1`, either.makeRight('0')],
  [`2 - 1`, either.makeRight('1')],
  [`1 - 2 - 3`, either.makeRight('-4')],
  [`1 - (2 - 3)`, either.makeRight('2')],
  [`(1 - 2) - 3`, either.makeRight('-4')],
  [`:integer.multiply(2)(2)`, either.makeRight('4')],
  [`2 * 2`, either.makeRight('4')],
  [`2 * -2`, either.makeRight('-4')],
  [`-2 * -2`, either.makeRight('4')],
  [`2 * 0`, either.makeRight('0')],
  [':flow(:atom.append(b))(:atom.append(a))(z)', either.makeRight('zab')],
  [
    `@runtime { :object.lookup("key which does not exist in runtime context") }`,
    either.makeRight({ tag: 'none', value: {} }),
  ],
  [
    `:object.lookup(output)({
      add_one: :integer.add(1)
      is_less_than_three: :integer.is_less_than(3)
      output: :is_less_than_three(:add_one(1))
    })`,
    either.makeRight({
      tag: 'some',
      value: 'true',
    }),
  ],
  [
    `:integer.add(
      :integer.subtract(1)(2)
    )(
      :integer.subtract(2)(4)
    )`,
    either.makeRight('3'),
  ],
  [
    `{
      true: true
      false: :boolean.not(:true)
    }`,
    either.makeRight({ true: 'true', false: 'false' }),
  ],
  [
    `@runtime {
      :flow(
        :match({
          none: "environment does not exist"
          some: :flow(
            :match({
              none: "environment.lookup does not exist"
              some: :apply(PATH)
            })
          )(
            :object.lookup(lookup)
          )
        })
      )(
        :object.lookup(environment)
      )
    }`,
    output => {
      if (either.isLeft(output)) {
        assert.fail(output.value.message)
      }
      assert(typeof output.value === 'object')
      assert.deepEqual(output.value['tag'], 'some')
      assert.deepEqual(typeof output.value['value'], 'string')
    },
  ],
  [
    `(a => b => c => { :a, :b, :c })(0)(1)(2)`,
    either.makeRight({ 0: 0, 1: 1, 2: 2 }),
  ],
  [
    `{
      a: {
        b: {
          c: z => {
            d: y => x => {
              e: {
                f: w => { g: { :z, :y, :x, :w, } }
              }
            }
          }
        }
      }
    }.a.b.c(a).d(b)(c).e.f(d).g`,
    either.makeRight({ 0: 'a', 1: 'b', 2: 'c', 3: 'd' }),
  ],
  [
    `@runtime { context =>
      :context.environment.lookup(PATH)
    }`,
    output => {
      if (either.isLeft(output)) {
        assert.fail(output.value.message)
      }
      assert(typeof output.value === 'object')
      assert.deepEqual(output.value['tag'], 'some')
      assert.deepEqual(typeof output.value['value'], 'string')
    },
  ],
  [
    `@if {
      true
      "it works!"
      @panic
    }`,
    either.makeRight('it works!'),
  ],
  [
    `{
      a
      b
      c
    }`,
    either.makeRight({ 0: 'a', 1: 'b', 2: 'c' }),
  ],
  [
    `@runtime { context =>
      @if {
        :boolean.not(:boolean.is(:context))
        "it works!"
        @panic
      }
    }`,
    either.makeRight('it works!'),
  ],
  [
    `{
      fibonacci: n =>
        @if {
          :integer.is_less_than(2)(:n)
          then: :n
          else: :fibonacci(:n - 1) + :fibonacci(:n - 2)
        }
      result: :fibonacci(10)
    }.result`,
    either.makeRight('55'),
  ],
  [
    `{
      +: a => b => :integer.add(:a)(:b)
      result: 1 + 1
     }.result`,
    either.makeRight('2'),
  ],
  [`1 + 1`, either.makeRight('2')],
  [`1 integer.add 1`, either.makeRight('2')],
  [`(1 + 1)`, either.makeRight('2')],
  [`(2 - 1) + (4 - 2)`, either.makeRight('3')],
  [`0 < 1`, either.makeRight('true')],
  [`1 > 0`, either.makeRight('true')],
  [`0 < 0`, either.makeRight('false')],
  [`0 > 0`, either.makeRight('false')],
  [`1 < 0`, either.makeRight('false')],
  [`0 > 1`, either.makeRight('false')],
  [`(a => (1 + :a))(1)`, either.makeRight('2')],
  [`2 |> (a => :a)`, either.makeRight('2')],
  [`a atom.append b atom.append c`, either.makeRight('abc')],
  [`b atom.append c atom.prepend a`, either.makeRight('abc')],
  [`(b atom.append c) atom.prepend a`, either.makeRight('abc')],
  [`a atom.append (c atom.prepend b)`, either.makeRight('abc')],
  [
    `{ a: "it works!" } object.lookup a`,
    either.makeRight({ tag: 'some', value: 'it works!' }),
  ],
  [`{ a: :identity }.a(1) + 1`, either.makeRight('2')],
  [
    `1
      + 2
      + 3
      + 4`,
    either.makeRight('10'),
  ],
  [
    `1 +
     2 +
     3 +
     4`,
    either.makeRight('10'),
  ],
  [`{ f: _ => 5 % 3 }.f(whatever)`, either.makeRight('2')],
  [
    `{
      one: 1
      two: :one + :one
    }.two`,
    either.makeRight('2'),
  ],
  [
    `@runtime { context =>
      (
        PATH
          |> :context.environment.lookup
          |> :match({
            none: _ => "$PATH not set"
            some: :atom.prepend("PATH=")
          })
      )
    }`,
    result => {
      if (either.isLeft(result)) {
        assert.fail(result.value.message)
      }
      const output = result.value
      assert(typeof output === 'string')
      assert(output.startsWith('PATH='))
    },
  ],
  [
    `{
      one: 1
      two: 2
      three: 3
      four: 4
      ten: :one + :two + :three + :four
    }.ten`,
    either.makeRight('10'),
  ],
  [
    `{
      add_ten: :integer.add(1) >> :integer.add(9)
    }.add_ten(0)`,
    either.makeRight('10'),
  ],
  [`1 + @if { true, 9, 1 }`, either.makeRight('10')],
  [
    `{
      1 + @if
      { true, 9, 1 }
    }.0`,
    either.makeRight('10'),
  ],
  [
    `(
      :+(1)
        >> :+(2)
        >> :+(3)
        >> :+(4)
    )(0)`,
    either.makeRight('10'),
  ],
  [
    `(
      :+(1) >>
      :+(2) >>
      :+(3) >>
      :+(4)
    )(0)`,
    either.makeRight('10'),
  ],
  [`a |> :atom.append(b) |> :atom.append(c)`, either.makeRight('abc')],
  [`a |> (:atom.append(b) >> :atom.append(c))`, either.makeRight('abc')],
  [`:|>(:>>(:atom.append(c))(:atom.append(b)))(a)`, either.makeRight('abc')],
  [
    `{
      append_bc: :atom.append(b) >> :atom.append(c)
      abc: a |> :append_bc
    }.abc`,
    either.makeRight('abc'),
  ],
  [
    `{
      nested_option: {
        tag: some,
        value: {
          tag: some,
          value: {
            tag: some,
            value: "it works!"
          }
        }
      }
      output: :nested_option match {
        none: unreachable
        some: :identity
      } match {
        none: unreachable
        some: :identity
      } match {
        none: unreachable
        some: :identity
      }
    }.output`,
    either.makeRight('it works!'),
  ],
  [
    // Lookups should never target keyword expression properties.
    `{
      {
        0: "it works!",
        result: { 0: "@lookup", 1: { 0: 0 } }
      }.result
      {
        1: "it works!",
        result: { 0: "@lookup", 1: { key: 1 } }
      }.result
      {
        key: "it works!",
        result: { 0: "@lookup", 1: { key: key } }
      }.result
      {
        body: "it works!",
        result: { 0: "@function", 1: { parameter: _, body: :body } }(_)
      }.result
      {
        parameter: "it works!",
        result: { 0: "@function", 1: { parameter: _, body: :parameter } }(_)
      }.result
      {
        1: "it works!",
        result: { 0: "@function", 1: { 0: _, 1: :1 } }(_)
      }.result
      {
        0: "it works!",
        result: { 0: "@function", 1: { 0: _, 1: :0 } }(_)
      }.result
      {
        1: "it works!",
        result: { 0: "@lookup", 1: { key: 1 } }
      }.result
      {
        1: "it does not work"
        result: {
          1: "it works!",
          result: { 0: "@lookup", 1: { key: 1 } }
        }.result
      }.result
    }`,
    either.makeRight({
      0: 'it works!',
      1: 'it works!',
      2: 'it works!',
      3: 'it works!',
      4: 'it works!',
      5: 'it works!',
      6: 'it works!',
      7: 'it works!',
      8: 'it works!',
    }),
  ],
  [
    `{
      a: 42 assume :natural_number.type
      b: true ~ :boolean.type
      c: {} ~ :object.type
      d: { z: -42 } assume { z: :integer.type }
      e: "not a number" assume @union { :integer.type, "not a number" }
    }`,
    either.makeRight({
      a: '42',
      b: 'true',
      c: {},
      d: { z: '-42' },
      e: 'not a number',
    }),
  ],
  [
    `"not a number" assume :integer.type`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],
  [
    `@runtime { context =>
      :context.environment.lookup("not a legal environment variable name")
    } match {
      none: _ => a
      some: _ => b
    }`,
    either.makeRight('a'),
  ],
  [`(a => b => :a + :b)(1)(1)`, either.makeRight('2')],
  [
    `{
      f: state => @if {
        :state.current > :state.limit
        then: "it works"
        else: :f({
          current: :state.current + 1
          limit: :state.limit
        })
      }
    }.f({ current: 0, limit: 3 })`,
    either.makeRight('it works'),
  ],
  [
    `(inner => @if {
      :inner.a
      then: "it works"
      else: { @panic }
    })({ a: true })`,
    either.makeRight('it works'),
  ],
  [
    `(outer =>
      (inner =>
        @if {
          condition: :boolean.or(:outer)(:inner.value)
          then: { @panic }
          else: :boolean.not(:inner.value)
        }
      )({ value: false })
    )(false)`,
    either.makeRight('true'),
  ],
  [
    `(outer =>
      (inner =>
        @if {
          condition: :boolean.or(:outer)(:inner.value)
          then: "it works"
          else: :boolean.not(:inner.value)
        }
      )({ value: false })
    )(true)`,
    either.makeRight('it works'),
  ],
  [
    `(:boolean.not ~ (:boolean.type ~> :boolean.type))(false)`,
    either.makeRight('true'),
  ],
  [
    `:boolean.not ~ (:boolean.type ~> :integer.type)`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],
  [
    `{ 1 integer.equals 1, 1 integer.equals 2 }`,
    either.makeRight({ 0: 'true', 1: 'false' }),
  ],
  [
    `{ b: 1, c: 1, d: 1 } object.overlay { a: 1, b: 2, c: 3 }`,
    either.makeRight({ a: '1', b: '2', c: '3', d: '1' }),
  ],
  [`:object.from_property(key)(value)`, either.makeRight({ key: 'value' })],
  [`(1 + 1) ~ :integer.type`, either.makeRight('2')],
  [
    `{
      1 ~ :something.type
      blah ~ :something.type
      {} ~ :something.type
      (a => :a) ~ :something.type
    }`,
    result => {
      assert(either.isRight(result))
    },
  ],
  [
    `"arbitrary value" ~ :nothing.type`,
    result => {
      assert(either.isLeft(result))
      assert('kind' in result.value)
      assert.deepEqual(result.value.kind, 'typeMismatch')
    },
  ],
  [
    // `true | (false || true) | false`
    'true | false || true | false',
    either.makeRight({
      0: '@union',
      // TODO: Consider normalizing away the duplicate `true`s.
      1: { 0: 'true', 1: 'true', 2: 'false' },
    }),
  ],
  [
    // `true | (false ~> (true | false))`
    'true | false ~> true | false',
    either.makeRight({
      '0': '@union',
      '1': {
        '0': 'true',
        '1': {
          '0': '@signature',
          '1': {
            parameter: 'false',
            return: { '0': '@union', '1': { '0': 'true', '1': 'false' } },
          },
        },
      },
    }),
  ],
  [
    // `true | (false => (true | false))`
    'true | false => true | false',
    either.makeRight({
      '0': '@union',
      '1': {
        '0': 'true',
        '1': {
          '0': '@function',
          '1': {
            parameter: 'false',
            body: { '0': '@union', '1': { '0': 'true', '1': 'false' } },
          },
        },
      },
    }),
  ],
  [
    // `false | (true ~ true) | false`
    'false | true ~ true | false',
    either.makeRight({
      '0': '@union',
      // TODO: Consider normalizing away the duplicate `false`s.
      '1': { '0': 'false', '1': 'true', '2': 'false' },
    }),
  ],
  [
    `{
      |>: :identity
      // TODO: Define \`|>\` as below once it's possible to annotate \`f\` as a
      // function type.
      // |>: f => a => :f(:a)

      ab: a |> :atom.append(b)
      abc: :ab |> :atom.append(c)
    }.abc`,
    either.makeRight('abc'),
  ],
])
