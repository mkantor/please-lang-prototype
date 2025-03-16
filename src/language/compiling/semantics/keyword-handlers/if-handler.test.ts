import { elaborationSuite, success } from '../test-utilities.test.js'

elaborationSuite('@if', [
  [{ 0: '@if', condition: 'false', then: 'no', else: 'yes' }, success('yes')],
  [{ 0: '@if', condition: 'true', then: 'yes', else: 'no' }, success('yes')],
  [
    {
      0: '@if',
      condition: 'true',
      then: 'it works!',
      else: { 0: '@panic' },
    },
    success('it works!'),
  ],
  [
    {
      a: 'it works!',
      b: {
        0: '@if',
        condition: 'true',
        then: { 0: '@lookup', key: 'a' },
        else: { 0: '@panic' },
      },
    },
    success({ a: 'it works!', b: 'it works!' }),
  ],
  [
    {
      0: '@if',
      condition: 'false',
      then: { 0: '@panic' },
      else: 'it works!',
    },
    success('it works!'),
  ],
  [
    {
      0: '@if',
      condition: {
        0: '@apply',
        function: {
          0: '@index',
          object: { 0: '@lookup', key: 'boolean' },
          query: { 0: 'not' },
        },
        argument: 'false',
      },
      then: 'it works!',
      else: { 0: '@panic' },
    },
    success('it works!'),
  ],
  [
    {
      0: '@if',
      1: {
        0: '@apply',
        function: {
          0: '@index',
          object: { 0: '@lookup', key: 'boolean' },
          query: { 0: 'not' },
        },
        argument: 'false',
      },
      2: 'it works!',
      3: { 0: '@panic' },
    },
    success('it works!'),
  ],
  [
    {
      a: {
        0: '@if',
        condition: { 0: '@lookup', key: 'b' },
        then: 'it works!',
        else: { 0: '@panic' },
      },
      b: 'true',
    },
    success({ a: 'it works!', b: 'true' }),
  ],
])
