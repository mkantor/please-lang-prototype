import either from '@matt.kantor/either'
import assert from 'node:assert'
import test, { suite } from 'node:test'
import * as orderedRecord from '../../ordered-record.js'
import { parseJson } from './json.js'

suite('order-preserving JSON parser', () => {
  test('strings', () => {
    assert.deepEqual(parseJson('"hello"'), either.makeRight('hello'))
    assert.deepEqual(parseJson('""'), either.makeRight(''))
  })

  test('numbers', () => {
    assert.deepEqual(parseJson('42'), either.makeRight(42))
    assert.deepEqual(parseJson('0'), either.makeRight(0))
    assert.deepEqual(parseJson('-5'), either.makeRight(-5))
    assert.deepEqual(parseJson('3.14'), either.makeRight(3.14))
    assert.deepEqual(parseJson('1e3'), either.makeRight(1e3))
    assert.deepEqual(parseJson('-1.5e-2'), either.makeRight(-1.5e-2))
  })

  test('booleans', () => {
    assert.deepEqual(parseJson('true'), either.makeRight(true))
    assert.deepEqual(parseJson('false'), either.makeRight(false))
  })

  test('null', () => {
    assert.deepEqual(parseJson('null'), either.makeRight(null))
  })

  test('strings with escape sequences', () => {
    assert.deepEqual(
      parseJson('"hello\\nworld"'),
      either.makeRight('hello\nworld'),
    )
    assert.deepEqual(parseJson('"quote: \\""'), either.makeRight('quote: "'))
    assert.deepEqual(
      parseJson('"backslash: \\\\"'),
      either.makeRight('backslash: \\'),
    )
    assert.deepEqual(parseJson('"\\t\\r\\b\\f"'), either.makeRight('\t\r\b\f'))
  })

  test('unicode escape sequences', () => {
    assert.deepEqual(parseJson('"\\u0041"'), either.makeRight('A'))
    assert.deepEqual(
      parseJson('"snowman: \\u2603"'),
      either.makeRight('snowman: ☃'),
    )
  })

  test('empty object', () => {
    assert.deepEqual(parseJson('{}'), either.makeRight(orderedRecord.empty))
  })

  test('simple object', () => {
    assert.deepEqual(
      parseJson('{"a":"b"}'),
      either.makeRight(orderedRecord.make([['a', 'b']])),
    )
  })

  test('object with potentially-reorderable properties', () => {
    // The initial motivation for this parser was to work around the fact that
    // integer-like keys appear first when iterating objects returned from
    // `JSON.parse`, rather than in insertion/source order.

    const plainObject: unknown = JSON.parse('{"a":"first","999":"second"}')
    // This is what we want to avoid:
    assert.deepEqual(Object.keys(plainObject ?? {}), ['999', 'a'])

    assert.deepEqual(
      parseJson(
        '{"a":"first","999":"second","0":"third","b":"forth","c":"fifth"}',
      ),
      either.makeRight(
        orderedRecord.make([
          ['a', 'first'],
          ['999', 'second'],
          ['0', 'third'],
          ['b', 'forth'],
          ['c', 'fifth'],
        ]),
      ),
    )
  })

  test('nested objects', () => {
    assert.deepEqual(
      parseJson('{"outer":{"inner":"value"}}'),
      either.makeRight(
        orderedRecord.make([
          ['outer', orderedRecord.make([['inner', 'value']])],
        ]),
      ),
    )
  })

  test('whitespace between tokens', () => {
    assert.deepEqual(
      parseJson('  {\n  "a"  :  1  ,\n  "b"  :  2\n  }  '),
      either.makeRight(
        orderedRecord.make([
          ['a', 1],
          ['b', 2],
        ]),
      ),
    )
  })

  test('empty array', () => {
    assert.deepEqual(parseJson('[]'), either.makeRight([]))
  })

  test('non-empty array', () => {
    assert.deepEqual(
      parseJson('[1,true,null,"text"]'),
      either.makeRight([1, true, null, 'text']),
    )
  })

  test('nested array', () => {
    assert.deepEqual(parseJson('[[1,2],[3]]'), either.makeRight([[1, 2], [3]]))
  })

  test('array of objects', () => {
    assert.deepEqual(
      parseJson('[{"a":1},{"b":2}]'),
      either.makeRight([
        orderedRecord.make([['a', 1]]),
        orderedRecord.make([['b', 2]]),
      ]),
    )
  })

  test('unterminated string', () => {
    assert(either.isLeft(parseJson('"unterminated')))
  })

  test('invalid escape', () => {
    assert(either.isLeft(parseJson('"\\x"')))
  })

  test('trailing comma in object', () => {
    assert(either.isLeft(parseJson('{"a":1,}')))
  })

  test('trailing comma in array', () => {
    assert(either.isLeft(parseJson('[1,]')))
  })

  test('non-string object key', () => {
    assert(either.isLeft(parseJson('{1:"a"}')))
  })

  test('completely empty input', () => {
    assert(either.isLeft(parseJson('')))
  })
})
