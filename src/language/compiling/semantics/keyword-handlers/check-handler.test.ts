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
  [
    {
      0: '@check',
      1: {
        type: {
          0: '@index',
          1: {
            0: { 0: '@lookup', 1: { 0: 'natural_number' } },
            1: { 0: 'type' },
          },
        },
        value: '42',
      },
    },
    success('42'),
  ],
  [
    {
      0: '@check',
      1: {
        type: {
          0: '@index',
          1: {
            0: { 0: '@lookup', 1: { 0: 'natural_number' } },
            1: { 0: 'type' },
          },
        },
        value: '"not a number"',
      },
    },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      1: {
        type: {
          0: '@index',
          1: {
            0: { 0: '@lookup', 1: { 0: 'boolean' } },
            1: { 0: 'type' },
          },
        },
        value: 'true',
      },
    },
    success('true'),
  ],
  [
    {
      0: '@check',
      1: {
        type: {
          0: '@union',
          1: {
            0: 'a',
            1: {
              0: '@index',
              1: {
                0: { 0: '@lookup', 1: { 0: 'natural_number' } },
                1: { 0: 'type' },
              },
            },
          },
        },
        value: 'a',
      },
    },
    success('a'),
  ],
  [
    {
      0: '@check',
      1: {
        type: {
          0: '@union',
          1: {
            0: 'a',
            1: {
              0: '@index',
              1: {
                0: { 0: '@lookup', 1: { 0: 'natural_number' } },
                1: { 0: 'type' },
              },
            },
          },
        },
        value: '42',
      },
    },
    success('42'),
  ],
  [
    {
      0: '@check',
      1: {
        type: {
          0: '@union',
          1: {
            0: 'a',
            1: {
              0: '@index',
              1: {
                0: { 0: '@lookup', 1: { 0: 'natural_number' } },
                1: { 0: 'type' },
              },
            },
          },
        },
        value: 'neither a number nor "a"',
      },
    },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      1: {
        type: {
          0: '@index',
          1: {
            0: { 0: '@lookup', 1: { 0: 'object' } },
            1: { 0: 'type' },
          },
        },
        value: {},
      },
    },
    success({}),
  ],
  [
    {
      0: '@check',
      1: {
        type: {
          0: '@index',
          1: {
            0: { 0: '@lookup', 1: { 0: 'object' } },
            1: { 0: 'type' },
          },
        },
        value: { hello: 'world', arbitrary: { properties: 'true' } },
      },
    },
    success({ hello: 'world', arbitrary: { properties: 'true' } }),
  ],
  [
    {
      0: '@check',
      1: {
        type: {
          0: '@index',
          1: {
            0: { 0: '@lookup', 1: { 0: 'object' } },
            1: { 0: 'type' },
          },
        },
        value: 'not an object',
      },
    },
    output => assert(either.isLeft(output)),
  ],
])
