import either from '@matt.kantor/either'
import assert from 'node:assert'
import { withPhantomData } from '../../../../phantom-data.js'
import { objectNodeFromOrderedEntries, prelude } from '../../../semantics.js'
import { elaborationSuite } from '../test-utilities.test.js'

elaborationSuite('@runtime', [
  [
    { 0: '@runtime', 1: { 0: { 0: '@lookup', 1: { key: 'identity' } } } },
    either.makeRight(
      withPhantomData<never>()(
        objectNodeFromOrderedEntries([
          ['0', '@runtime'],
          ['1', objectNodeFromOrderedEntries([['function', prelude.identity]])],
        ]),
      ),
    ),
  ],
  [
    { 0: '@runtime', 1: { 0: 'not a function' } },
    output => {
      assert(either.isLeft(output))
    },
  ],
])
