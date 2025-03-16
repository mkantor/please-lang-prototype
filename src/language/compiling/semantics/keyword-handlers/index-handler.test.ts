import either from '@matt.kantor/either'
import assert from 'node:assert'
import { elaborationSuite, success } from '../test-utilities.test.js'

elaborationSuite('@index', [
  [{ 0: '@index', 1: { foo: 'bar' }, 2: { 0: 'foo' } }, success('bar')],
  [
    { 0: '@index', object: { foo: 'bar' }, query: { 0: 'foo' } },
    success('bar'),
  ],
  [
    {
      0: '@index',
      object: { a: { b: { c: 'it works' } } },
      query: { 0: 'a', 1: 'b', 2: 'c' },
    },
    success('it works'),
  ],
  [
    {
      0: '@index',
      object: { a: { b: { c: 'it works' } } },
      query: { 0: 'a', 1: 'b' },
    },
    success({ c: 'it works' }),
  ],
  [
    { 0: '@index', object: {}, query: { 0: 'thisPropertyDoesNotExist' } },
    output => assert(either.isLeft(output)),
  ],
])
