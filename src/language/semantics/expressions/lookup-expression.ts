import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Atom, Molecule } from '../../parsing.js'
import { isKeywordExpressionWithArgument } from '../expression.js'
import { keyPathToMolecule, type NonEmptyKeyPath } from '../key-path.js'
import { makeObjectNode, type ObjectNode } from '../object-node.js'
import {
  stringifySemanticGraphForEndUser,
  type SemanticGraph,
} from '../semantic-graph.js'
import { readArgumentsFromExpression } from './expression-utilities.js'
import { makeIndexExpression } from './index-expression.js'

export type LookupExpression = ObjectNode & {
  readonly 0: '@lookup'
  readonly 1: {
    readonly key: Atom
  }
}

export const readLookupExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, LookupExpression> =>
  isKeywordExpressionWithArgument('@lookup', node)
    ? either.flatMap(readArgumentsFromExpression(node, ['key']), ([key]) => {
        if (typeof key !== 'string') {
          return either.makeLeft({
            kind: 'invalidExpression',
            message: `lookup key must be an atom, got \`${stringifySemanticGraphForEndUser(
              key,
            )}\``,
          })
        } else {
          return either.makeRight(makeLookupExpression(key))
        }
      })
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not a `@lookup` expression',
      })

export const makeLookupExpression = (key: Atom): LookupExpression =>
  makeObjectNode({
    0: '@lookup',
    1: makeObjectNode({ key }),
  })

export const keyPathToLookupExpression = (keyPath: NonEmptyKeyPath) => {
  const [initialKey, ...indexes] = keyPath
  const initialLookup = makeLookupExpression(initialKey)
  if (indexes.length === 0) {
    return initialLookup
  } else {
    return makeIndexExpression({
      object: initialLookup,
      query: makeObjectNode(keyPathToMolecule(indexes)),
    })
  }
}
