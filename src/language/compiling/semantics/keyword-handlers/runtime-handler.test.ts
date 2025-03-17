import either from '@matt.kantor/either'
import assert from 'node:assert'
import { withPhantomData } from '../../../../phantom-data.js'
import { makeObjectNode, prelude } from '../../../semantics.js'
import { elaborationSuite } from '../test-utilities.test.js'

elaborationSuite('@runtime', [
  [
    { 0: '@runtime', 1: { 0: '@lookup', key: 'identity' } },
    either.makeRight(
      withPhantomData<never>()(
        makeObjectNode({ 0: '@runtime', function: prelude['identity']! }),
      ),
    ),
  ],
  [
    { 0: '@runtime', 1: 'not a function' },
    output => assert(either.isLeft(output)),
  ],
])
