import either from '@matt.kantor/either'
import assert from 'node:assert'
import { elaborationSuite, success } from '../test-utilities.test.js'

elaborationSuite('@lookup', [
  [
    {
      foo: 'bar',
      bar: { 0: '@lookup', 1: 'foo' },
    },
    success({ foo: 'bar', bar: 'bar' }),
  ],
  [
    {
      foo: 'bar',
      bar: { 0: '@lookup', key: 'foo' },
    },
    success({ foo: 'bar', bar: 'bar' }),
  ],
  [
    {
      foo: 'bar',
      bar: { 0: '@lookup', 1: 'foo' },
    },
    success({ foo: 'bar', bar: 'bar' }),
  ],
  [
    {
      a: 'A',
      b: {
        a: 'different A',
        b: { 0: '@lookup', key: 'a' },
      },
    },
    success({
      a: 'A',
      b: {
        a: 'different A',
        b: 'different A',
      },
    }),
  ],
  [
    {
      foo: 'bar',
      bar: { 0: '@lookup', 1: 'foo' },
      baz: { 0: '@lookup', 1: 'bar' },
    },
    success({ foo: 'bar', bar: 'bar', baz: 'bar' }),
  ],
  [
    { a: { 0: '@lookup', _: 'missing key' } },
    output => assert(either.isLeft(output)),
  ],
  [
    { a: { 0: '@lookup', key: 'thisPropertyDoesNotExist' } },
    output => assert(either.isLeft(output)),
  ],

  // lexical scoping
  [
    {
      a: 'C',
      b: {
        c: { 0: '@lookup', key: 'a' },
      },
    },
    success({
      a: 'C',
      b: {
        c: 'C',
      },
    }),
  ],
  [
    {
      a: 'C',
      b: {
        a: 'other C', // this `a` should be referenced
        c: { 0: '@lookup', key: 'a' },
      },
    },
    success({
      a: 'C',
      b: {
        a: 'other C',
        c: 'other C',
      },
    }),
  ],
])
