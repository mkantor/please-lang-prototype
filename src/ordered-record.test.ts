import option from '@matt.kantor/option'
import assert from 'node:assert'
import test, { suite } from 'node:test'
import {
  empty,
  filter,
  get,
  has,
  isOrderedRecord,
  keys,
  make,
  mapValues,
  merge,
  remove,
  set,
  size,
  values,
} from './ordered-record.js'

suite('OrderedRecord', () => {
  test('`make` with empty source yields size 0', () => {
    const record = make([])
    assert.equal(size(record), 0)
    assert.deepEqual(record.entries, [])
    assert.deepEqual(keys(record), [])
    assert.deepEqual(values(record), [])
  })

  test('`empty` returns an empty record', () => {
    assert.equal(size(empty), 0)
  })

  test('`make` preserves initial order of integer-like keys', () => {
    // The initial motivation for `OrderedRecord` was to work around the fact
    // that integer-like keys appear first when iterating JavaScript objects,
    // rather than in insertion/source order.

    const jsObject = { a: 1, '999': 2, b: 3, '0': 4, c: 5 }
    // This is what we want to avoid:
    assert.deepEqual(Object.keys(jsObject), ['0', '999', 'a', 'b', 'c'])

    const record = make([
      ['a', 1],
      ['0', 2],
      ['b', 3],
      ['999', 4],
      ['c', 5],
    ])
    assert.deepEqual(keys(record), ['a', '0', 'b', '999', 'c'])
    assert.deepEqual(values(record), [1, 2, 3, 4, 5])
  })

  test('`make` with duplicate keys: first determines position, last determines value', () => {
    const record = make([
      ['a', 1],
      ['b', 2],
      ['a', 3],
    ])
    assert.deepEqual(keys(record), ['a', 'b'])
    assert.deepEqual(get(record, 'a'), option.makeSome(3))
    assert.deepEqual(get(record, 'b'), option.makeSome(2))
  })

  test('`get`ting missing key returns `none`', () => {
    const record = make([['a', 1]])
    assert.deepEqual(get(record, 'missing'), option.none)
  })

  test('`has`', () => {
    const record = make([['a', 1]])
    assert.equal(has(record, 'a'), true)
    assert.equal(has(record, 'b'), false)
  })

  test('`set` appends new keys at the end', () => {
    const original = make([
      ['a', 1],
      ['b', 2],
    ])
    const updated = set(original, 'c', 3)
    assert.deepEqual(keys(updated), ['a', 'b', 'c'])
    assert.deepEqual(get(updated, 'c'), option.makeSome(3))
  })

  test('`set` replaces existing key without moving it', () => {
    const original = make([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    const updated = set(original, 'b', 99)
    assert.deepEqual(keys(updated), ['a', 'b', 'c'])
    assert.deepEqual(values(updated), [1, 99, 3])
  })

  test("`set` doesn't mutate", () => {
    const original = make([['a', 1]])
    const originalEntries = original.entries
    const _updated = set(original, 'b', 2)
    assert.equal(original.entries, originalEntries)
    assert.deepEqual(keys(original), ['a'])
  })

  test('`remove`ing a key preserves order of remaining keys', () => {
    const original = make([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    const updated = remove(original, 'b')
    assert.deepEqual(keys(updated), ['a', 'c'])
    assert.deepEqual(values(updated), [1, 3])
  })

  test('`remove`ing a missing key is a no-op', () => {
    const original = make([['a', 1]])
    const updated = remove(original, 'missing')
    assert.deepEqual(keys(updated), ['a'])
  })

  test("`remove` doesn't mutate", () => {
    const original = make([['a', 1]])
    const _updated = remove(original, 'a')
    assert.equal(size(original), 1)
  })

  test('`merge`ing mixed overlapping and new keys', () => {
    const first = make([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    const second = make([
      ['b', 99],
      ['d', 4],
      ['e', 5],
    ])
    const result = merge(first, second)
    assert.deepEqual(keys(result), ['a', 'b', 'c', 'd', 'e'])
    assert.deepEqual(values(result), [1, 99, 3, 4, 5])
  })

  test('integer-string keys preserve their position through `merge`', () => {
    const first = make([
      ['a', 1],
      ['0', 2],
      ['b', 3],
    ])
    const second = make([['0', 99]])
    const result = merge(first, second)
    assert.deepEqual(keys(result), ['a', '0', 'b'])
    assert.deepEqual(values(result), [1, 99, 3])
  })

  test('`mapValues` preserves order and transforms values', () => {
    const record = make([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    const doubled = mapValues(record, value => value * 2)
    assert.deepEqual(keys(doubled), ['a', 'b', 'c'])
    assert.deepEqual(values(doubled), [2, 4, 6])
  })

  test('`mapValues` passes the key to the transform', () => {
    const record = make([
      ['a', 1],
      ['b', 2],
    ])
    const result = mapValues(record, (value, key) => `${key}=${value}`)
    assert.deepEqual(values(result), ['a=1', 'b=2'])
  })

  test('`filter` preserves order and keeps passing entries', () => {
    const record = make([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4],
    ])
    const evens = filter(record, value => value % 2 === 0)
    assert.deepEqual(keys(evens), ['b', 'd'])
    assert.deepEqual(values(evens), [2, 4])
  })

  test('records with same entries in same order are deeply-equal', () => {
    const first = make([
      ['a', 1],
      ['b', 2],
    ])
    const second = make([
      ['a', 1],
      ['b', 2],
    ])
    assert.deepEqual(first, second)
  })

  test("records with same entries in different order aren't deeply-equal", () => {
    // Ensure that `assert.deepEqual` validates ordering in tests.
    const first = make([
      ['a', 1],
      ['b', 2],
    ])
    const second = make([
      ['b', 2],
      ['a', 1],
    ])
    assert.notDeepEqual(first, second)
  })

  test('`isOrderedRecord`', () => {
    assert.equal(isOrderedRecord(make([['a', 1]])), true)
    assert.equal(isOrderedRecord(empty), true)
    assert.equal(isOrderedRecord({ entries: [['a', 1]] }), false)
    assert.equal(isOrderedRecord(null), false)
    assert.equal(isOrderedRecord(undefined), false)
    assert.equal(isOrderedRecord('string'), false)
    assert.equal(isOrderedRecord(42), false)
    assert.equal(isOrderedRecord([]), false)
  })
})
