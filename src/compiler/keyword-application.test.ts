import assert from 'node:assert'
import { testCases } from '../_lib.test.js'
import * as either from '../adts/either.js'
import { withPhantomData } from '../phantom-data.js'
import type { Atom } from './atom.js'
import * as keywordApplication from './keyword-application.js'
import { literalValueToSemanticNode } from './keywords.js'
import type { Molecule } from './molecule.js'
import type { Canonicalized, KeywordsApplied } from './stages.js'

const applyKeywordsSuite = testCases(
  (input: Atom | Molecule) =>
    keywordApplication.applyKeywords(withPhantomData<Canonicalized>()(input)),
  input => `applying keywords in \`${JSON.stringify(input)}\``,
)

const success = (output: Atom | Molecule) =>
  either.makeRight(
    withPhantomData<KeywordsApplied>()(literalValueToSemanticNode(output)),
  )

applyKeywordsSuite('basic keyword syntax', [
  [{}, success({})],
  ['', success('')],
  [{ key: 'value' }, success({ key: 'value' })],
  [{ key: { key: 'value' } }, success({ key: { key: 'value' } })],
  [{ '@@key': '@@value' }, success({ '@key': '@value' })],
  [
    { '@@key': { nested: '@@value' } },
    success({ '@key': { nested: '@value' } }),
  ],
  [{ key: { 0: '@@escaped' } }, success({ key: { 0: '@escaped' } })],
  [{ 0: '@@escaped' }, success({ 0: '@escaped' })],
  [{ key: { 1: '@@escaped' } }, success({ key: { 1: '@escaped' } })],
  ['@@escaped', success('@escaped')],
  [{ 0: { 0: '@@escaped' } }, success({ 0: { 0: '@escaped' } })],
  [
    { key: { 0: '@someUnknownKeyword' } },
    output => assert(either.isLeft(output)),
  ],
  [{ '@someUnknownKeyword': 'value' }, output => assert(either.isLeft(output))],
  [{ key: '@someUnknownKeyword' }, output => assert(either.isLeft(output))],
  [{ '@todo': 'value' }, output => assert(either.isLeft(output))],
  [{ key: '@todo' }, output => assert(either.isLeft(output))],
  [
    { 0: '@todo this is also not valid' },
    output => assert(either.isLeft(output)),
  ],
])

applyKeywordsSuite('@todo', [
  [{ 0: '@todo', 1: 'blah' }, success({})],
  [{ 0: '@todo', 1: { 0: '@@blah' } }, success({})],
  [
    {
      key1: { 0: '@todo', 1: 'this should be replaced with an empty object' },
      key2: { 0: '@todo' },
    },
    success({ key1: {}, key2: {} }),
  ],
])

applyKeywordsSuite('@check', [
  [{ 0: '@check', 1: 'a', 2: 'a' }, success('a')],
  [{ 0: '@check', type: 'a', value: 'a' }, success('a')],
  [{ 0: '@check', type: '', value: '' }, success('')],
  [{ 0: '@check', type: '@@a', value: '@@a' }, success('@a')],
  [{ 0: '@check', 1: 'a', 2: 'B' }, output => assert(either.isLeft(output))],
  [
    { 0: '@check', type: 'a', value: 'B' },
    output => assert(either.isLeft(output)),
  ],
  [
    { 0: '@check', type: 'a', value: {} },
    output => assert(either.isLeft(output)),
  ],
  [
    { 0: '@check', type: {}, value: 'a' },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      type: { a: 'b' },
      value: { a: 'not b' },
    },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      type: { something: { more: 'complicated' } },
      value: { something: { more: 'complicated' } },
    },
    success({ something: { more: 'complicated' } }),
  ],
  [
    {
      0: '@check',
      type: { something: { more: 'complicated' } },
      value: {
        something: { more: 'complicated, which also does not typecheck' },
      },
    },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      type: { a: 'b' },
      value: {},
    },
    output => assert(either.isLeft(output)),
  ],
  [
    {
      0: '@check',
      type: { a: { b: 'c' } },
      value: { a: {} },
    },
    output => assert(either.isLeft(output)),
  ],
  // values with excess properties:
  [
    {
      0: '@check',
      type: { a: 'b' },
      value: { a: 'b', c: 'd' },
    },
    success({ a: 'b', c: 'd' }),
  ],
  [
    {
      0: '@check',
      type: {},
      value: { a: 'b' },
    },
    success({ a: 'b' }),
  ],
  [
    {
      0: '@check',
      type: { a: {} },
      value: { a: { b: 'c' } },
    },
    success({ a: { b: 'c' } }),
  ],
])
