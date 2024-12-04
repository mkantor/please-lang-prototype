import { type Either, type Option } from '../../adts.js'
import type { Writable } from '../../utility-types.js'
import type {
  DependencyUnavailable,
  Panic,
  UnserializableValueError,
} from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { nodeTag, type SemanticGraph } from './semantic-graph.js'
import { type FunctionType } from './type-system/type-formats.js'

export type FunctionNode = ((
  value: SemanticGraph,
) => Either<DependencyUnavailable | Panic, SemanticGraph>) & {
  readonly [nodeTag]: 'function'
  readonly parameterName: Option<Atom>
  readonly signature: FunctionType['signature']
  readonly serialize: () => Either<UnserializableValueError, Molecule>
}

export const isFunctionNode = (node: SemanticGraph) =>
  typeof node === 'function' && node[nodeTag] === 'function'

export const makeFunctionNode = (
  signature: FunctionType['signature'],
  serialize: FunctionNode['serialize'],
  parameterName: Option<Atom>,
  f: (
    value: SemanticGraph,
  ) => Either<DependencyUnavailable | Panic, SemanticGraph>,
): FunctionNode => {
  const node: ((
    value: SemanticGraph,
  ) => Either<DependencyUnavailable | Panic, SemanticGraph>) &
    Writable<FunctionNode> = value => f(value)
  node[nodeTag] = 'function'
  node.parameterName = parameterName
  node.signature = signature
  node.serialize = serialize
  return node
}

export const serializeFunctionNode = (
  node: FunctionNode,
): Either<UnserializableValueError, Molecule> => node.serialize()
