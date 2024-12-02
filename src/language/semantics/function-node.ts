import { type Either } from '../../adts.js'
import type { Writable } from '../../utility-types.js'
import type { Panic, UnserializableValueError } from '../errors.js'
import type { Molecule } from '../parsing.js'
import {
  type FullyElaboratedSemanticGraph,
  type PartiallyElaboratedSemanticGraph,
  nodeTag,
} from './semantic-graph.js'
import { type FunctionType } from './type-system/type-formats.js'

export type FunctionNode = ((
  value: FullyElaboratedSemanticGraph,
) => Either<Panic, FullyElaboratedSemanticGraph>) & {
  readonly [nodeTag]: 'function'
  readonly signature: FunctionType['signature']
  readonly serialize: () => Either<UnserializableValueError, Molecule>
}

export const isFunctionNode = (node: PartiallyElaboratedSemanticGraph) =>
  typeof node === 'function' && node[nodeTag] === 'function'

export const makeFunctionNode = (
  signature: FunctionType['signature'],
  serialize: FunctionNode['serialize'],
  f: (
    value: FullyElaboratedSemanticGraph,
  ) => Either<Panic, FullyElaboratedSemanticGraph>,
): FunctionNode => {
  const node: ((
    value: FullyElaboratedSemanticGraph,
  ) => Either<Panic, FullyElaboratedSemanticGraph>) &
    Writable<FunctionNode> = value => f(value)
  node[nodeTag] = 'function'
  node.signature = signature
  node.serialize = serialize
  return node
}

export const serializeFunctionNode = (
  node: FunctionNode,
): Either<UnserializableValueError, Molecule> => node.serialize()
