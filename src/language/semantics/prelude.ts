import { makeObjectNode } from './object-node.js'
import { atom } from './stdlib/atom.js'
import { boolean } from './stdlib/boolean.js'
import { globalFunctions } from './stdlib/global-functions.js'
import { integer } from './stdlib/integer.js'
import { natural_number } from './stdlib/natural-number.js'
import { nothing } from './stdlib/nothing.js'
import { object } from './stdlib/object.js'
import { something } from './stdlib/something.js'

export const prelude = makeObjectNode({
  ...globalFunctions,
  atom: makeObjectNode(atom),
  boolean: makeObjectNode(boolean),
  integer: makeObjectNode(integer),
  natural_number: makeObjectNode(natural_number),
  nothing: makeObjectNode(nothing),
  object: makeObjectNode(object),
  something: makeObjectNode(something),

  // Aliases:
  '>>': globalFunctions.flow,
  '|>': globalFunctions.identity,
  '+': integer.add,
  '*': integer.multiply,
  '-': integer.subtract,
  '<': integer.less_than,
  '>': integer.greater_than,
  '%': natural_number.modulo,
  '&&': boolean.and,
  '||': boolean.or,
})
