import either from '@matt.kantor/either'
import assert from 'node:assert'
import { elaborationSuite, success } from '../test-utilities.test.js'

elaborationSuite('@check', [
  [{ 0: '@check', 1: { 0: 'a', 1: 'a' } }, success('a')],
  [{ 0: '@check', 1: { type: 'a', value: 'a' } }, success('a')],
  [{ 0: '@check', 1: { type: '', value: '' } }, success('')],
  [{ 0: '@check', 1: { type: '@@a', value: '@@a' } }, success('@a')],
  [
    { 0: '@check', 1: { 0: 'a', 1: 'B' } },
    output => assert(either.isLeft(output)),
  ],
  [
    { 0: '@check', 1: { type: 'a', value: 'B' } },
    output => assert(either.isLeft(output)),
  ],
  [
    { 0: '@check', 1: { type: 'a', value: {} } },
    output => assert(either.isLeft(output)),
  ],
  [
    { 0: '@check', 1: { type: {}, value: 'a' } },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      1: {
        type: { a: 'b' },
        value: { a: 'not b' },
      },
    },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      1: {
        type: { something: { more: 'complicated' } },
        value: { something: { more: 'complicated' } },
      },
    },
    success({ something: { more: 'complicated' } }),
  ],
  [
    {
      0: '@check',
      1: {
        type: { something: { more: 'complicated' } },
        value: {
          something: { more: 'complicated, which also does not typecheck' },
        },
      },
    },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      1: {
        type: { a: 'b' },
        value: {},
      },
    },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      1: {
        type: { a: { b: 'c' } },
        value: { a: {} },
      },
    },
    output => assert(either.isLeft(output)),
  ],
  // values with excess properties:
  [
    {
      0: '@check',
      1: {
        type: { a: 'b' },
        value: { a: 'b', c: 'd' },
      },
    },
    success({ a: 'b', c: 'd' }),
  ],
  [
    {
      0: '@check',
      1: {
        type: {},
        value: { a: 'b' },
      },
    },
    success({ a: 'b' }),
  ],
  [
    {
      0: '@check',
      1: {
        type: { a: {} },
        value: { a: { b: 'c' } },
      },
    },
    success({ a: { b: 'c' } }),
  ],
])
