import { makeObjectNode } from './object-node.js'
import { atom } from './stdlib/atom.js'
import { boolean } from './stdlib/boolean.js'
import { globalFunctions } from './stdlib/global-functions.js'
import { integer } from './stdlib/integer.js'
import { natural_number } from './stdlib/natural-number.js'
import { object } from './stdlib/object.js'

export const prelude = makeObjectNode({
  ...globalFunctions,
  boolean: makeObjectNode(boolean),
  natural_number: makeObjectNode(natural_number),
  integer: makeObjectNode(integer),
  atom: makeObjectNode(atom),
  object: makeObjectNode(object),

  // Aliases:
  '>>': globalFunctions.flow,
  '|>': globalFunctions.identity,
  '+': integer.add,
  '-': integer.subtract,
  '<': integer.less_than,
  '>': integer.greater_than,
  '%': natural_number.modulo,
})
