import { testCases } from '../_lib.test.js'
import { withPhantomData } from '../phantom-data.js'
import type { Atom } from './atom.js'
import type { Molecule } from './molecule.js'
import * as molecule from './molecule.js'
import type { Canonicalized } from './stages.js'

const output = withPhantomData<Canonicalized>()<Atom | Molecule>

testCases(
  molecule.canonicalize,
  input => `canonicalizing \`${JSON.stringify(input)}\``,
)('canonicalization', [
  [{}, output({})],
  [[], output({})],
  ['a', output('a')],
  [1, output('1')],
  [Number.EPSILON, output('2.220446049250313e-16')],
  [null, output('null')],
  [true, output('true')],
  [false, output('false')],
  [['a'], output({ 0: 'a' })],
  [{ 0: 'a' }, output({ 0: 'a' })],
  [{ 1: 'a' }, output({ 1: 'a' })],
  [
    ['a', { b: [], c: { d: ['e', {}, 42] } }, 'f', { g: null }, true],
    output({
      0: 'a',
      1: { b: {}, c: { d: { 0: 'e', 1: {}, 2: '42' } } },
      2: 'f',
      3: { g: 'null' },
      4: 'true',
    }),
  ],
])
