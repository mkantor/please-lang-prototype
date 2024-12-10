import assert from 'node:assert'
import { either, type Either } from './adts.js'
import { compile } from './language/compiling.js'
import type { Atom, Molecule } from './language/parsing.js'
import { parse } from './language/parsing/parser.js'
import { evaluate } from './language/runtime.js'
import { testCases } from './test-utilities.test.js'

type SimpleResult = Either<{ readonly message: string }, Atom | Molecule>

const endToEnd = (input: string) => {
  const syntaxTree: SimpleResult = parse(input)
  const program: SimpleResult = either.flatMap(syntaxTree, compile)
  const runtimeOutput: SimpleResult = either.flatMap(program, evaluate)
  return runtimeOutput
}

testCases(endToEnd, code => code)('end-to-end tests', [
  ['""', either.makeRight('')],
  ['{}', either.makeRight({})],
  ['hi', either.makeRight('hi')],
  ['{{{}}}', either.makeRight({ 0: { 0: {} } })],
  ['"hello world"', either.makeRight('hello world')],
  ['{foo:bar}', either.makeRight({ foo: 'bar' })],
  ['{a,b,c}', either.makeRight({ 0: 'a', 1: 'b', 2: 'c' })],
  ['{,a,b,c,}', either.makeRight({ 0: 'a', 1: 'b', 2: 'c' })],
  ['{a,1:overwritten,c}', either.makeRight({ 0: 'a', 1: 'c' })],
  ['{overwritten,0:a,c}', either.makeRight({ 0: 'a', 1: 'c' })],
  ['{@check type:true value:true}', either.makeRight('true')],
  ['{a:A b:{@lookup {a}}}', either.makeRight({ a: 'A', b: 'A' })],
  ['{a:A b: :{a}}', either.makeRight({ a: 'A', b: 'A' })],
  ['{a:A {@lookup {a}}}', either.makeRight({ a: 'A', 0: 'A' })],
  ['{a:A :{a}}', either.makeRight({ a: 'A', 0: 'A' })],
  ['{ a: (a => :a)(A) }', either.makeRight({ a: 'A' })],
  ['(a => :a)(A)', either.makeRight('A')],
  [
    '{ a: a => :a, b: :a(A) }',
    result => {
      if (either.isLeft(result)) {
        assert.fail(result.value.message)
      }
      assert(typeof result.value === 'object')
      assert.deepEqual(result.value.b, 'A')
    },
  ],
  [
    // TODO: Should functions be implicitly serialized? Or should this be an error?
    '(a => :a)',
    either.makeRight({
      0: '@function',
      parameter: 'a',
      body: { 0: '@lookup', query: { 0: 'a' } },
    }),
  ],
  ['{ a: ({ A }) }', either.makeRight({ a: { 0: 'A' } })],
  ['{ a: (A) }', either.makeRight({ a: 'A' })],
  ['{ a: ("A A A") }', either.makeRight({ a: 'A A A' })],
  ['{ ("a"): A }', either.makeRight({ a: 'A' })],
  ['{ a: :(b), b: B }', either.makeRight({ a: 'B', b: 'B' })],
  ['{ a: :("b"), b: B }', either.makeRight({ a: 'B', b: 'B' })],
  ['{ (a: A) (b: B) }', either.makeRight({ a: 'A', b: 'B' })],
  ['({ ((a): :(b)) ((b): B) })', either.makeRight({ a: 'B', b: 'B' })],
  ['{ (a: :(")")), (")": (B)) }', either.makeRight({ a: 'B', ')': 'B' })],
  [':match({ a: A })({ tag: a, value: {} })', either.makeRight('A')],
  [':{string concatenate}(a)(b)', either.makeRight('ba')],
  [
    ':flow({ :string.concatenate(a) :string.concatenate(b) })(z)',
    either.makeRight('zab'),
  ],
  [
    `{
        "static data":"blah blah blah"
        "evaluated data": {
          0:@runtime
          function:{
            0:@apply
            function:{0:@lookup query:{0:object 1:lookup}}
            argument:"key which does not exist in runtime context"
          }
        }
      }`,
    either.makeRight({
      'static data': 'blah blah blah',
      'evaluated data': { tag: 'none', value: {} },
    }),
  ],
  [
    `{@runtime
      :{object lookup}("key which does not exist in runtime context")
    }`,
    either.makeRight({ tag: 'none', value: {} }),
  ],
  [
    `{@runtime
      {@apply
        {@lookup { flow }}
        {
          {@apply
            {@lookup { object lookup }}
            environment
          }
          {@apply
            {@lookup { match }}
            {
              none: "environment does not exist"
              some: {@apply
                {@lookup { flow }}
                {
                  {@apply
                    {@lookup { object lookup }}
                    lookup
                  }
                  {@apply
                    {@lookup { match }}
                    {
                      none: "environment.lookup does not exist"
                      some: {@apply
                        {@lookup { apply }}
                        PATH
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`,
    output => {
      if (either.isLeft(output)) {
        assert.fail(output.value.message)
      }
      assert(typeof output.value === 'object')
      assert.deepEqual(output.value.tag, 'some')
      assert.deepEqual(typeof output.value.value, 'string')
    },
  ],
  [
    `{@runtime {@apply :flow {
      {@apply :{object lookup} environment}
      {@apply :match {
        none: "environment does not exist"
        some: {@apply :flow {
          {@apply :{object lookup} lookup}
          {@apply :match {
            none: "environment.lookup does not exist"
            some: {@apply :apply PATH}
          }}
        }}
      }}
    }}}`,
    output => {
      if (either.isLeft(output)) {
        assert.fail(output.value.message)
      }
      assert(typeof output.value === 'object')
      assert.deepEqual(output.value.tag, 'some')
      assert.deepEqual(typeof output.value.value, 'string')
    },
  ],
  [
    `{@runtime :flow({
      :{object lookup}(environment)
      :match({
        none: "environment does not exist"
        some: :flow({
          :{object lookup}(lookup)
          :match({
            none: "environment.lookup does not exist"
            some: :apply(PATH)
          })
        })
      })
    })}`,
    output => {
      if (either.isLeft(output)) {
        assert.fail(output.value.message)
      }
      assert(typeof output.value === 'object')
      assert.deepEqual(output.value.tag, 'some')
      assert.deepEqual(typeof output.value.value, 'string')
    },
  ],
  [
    `{@runtime context =>
      :context.environment.lookup(PATH)
    }`,
    output => {
      if (either.isLeft(output)) {
        assert.fail(output.value.message)
      }
      assert(typeof output.value === 'object')
      assert.deepEqual(output.value.tag, 'some')
      assert.deepEqual(typeof output.value.value, 'string')
    },
  ],
  [`:natural_number.add(1)(1)`, either.makeRight('2')],
  [
    `:natural_number.add(one)(juan)`,
    output => {
      assert(either.isLeft(output))
    },
  ],
  [`:integer.add(42)(-1)`, either.makeRight('41')],
  [`:integer.subtract(-1)(-1)`, either.makeRight('0')],
  [`:integer.subtract(1)(2)`, either.makeRight('1')],
  [
    `:object.lookup(output)({
      add_one: :integer.add(1)
      less_than_three: :integer.less_than(3)
      output: :less_than_three(:add_one(1))
    })`,
    either.makeRight({
      tag: 'some',
      value: 'true',
    }),
  ],
])
