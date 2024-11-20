import assert from 'node:assert'
import { either, type Either } from './adts.js'
import { compile } from './language/compiling.js'
import './language/compiling/compiler.test.js'
import './language/compiling/parsing.test.js'
import './language/compiling/semantics.test.js'
import type { Atom, Molecule } from './language/parsing.js'
import { parse } from './language/parsing/parser.js'
import { evaluate } from './language/runtime.js'
import './language/runtime/evaluator.test.js'
import './language/semantics/type-system.test.js'
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
      {@apply
        {@lookup {object lookup}}
        "key which does not exist in runtime context"
      }
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
      assert(!either.isLeft(output) && typeof output.value === 'object')
      assert.deepEqual(output.value.tag, 'some')
      assert.deepEqual(typeof output.value.value, 'string')
    },
  ],
  [
    `{@runtime {@apply :{flow} {
      {@apply :{object lookup} environment}
      {@apply :{match} {
        none: "environment does not exist"
        some: {@apply :{flow} {
          {@apply :{object lookup} lookup}
          {@apply :{match} {
            none: "environment.lookup does not exist"
            some: {@apply :{apply} PATH}
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
])
