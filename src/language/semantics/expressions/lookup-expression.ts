import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Atom, Molecule } from '../../parsing.js'
import { isSpecificExpression } from '../expression.js'
import { makeObjectNode, type ObjectNode } from '../object-node.js'
import {
  stringifySemanticGraphForEndUser,
  type SemanticGraph,
} from '../semantic-graph.js'
import {
  asSemanticGraph,
  readArgumentsFromExpression,
} from './expression-utilities.js'

export type LookupExpression = ObjectNode & {
  readonly 0: '@lookup'
  readonly key: Atom
}

export const readLookupExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, LookupExpression> =>
  isSpecificExpression('@lookup', node)
    ? either.flatMap(
        readArgumentsFromExpression(node, [['key', '1']]),
        ([key]) => {
          if (typeof key !== 'string') {
            return either.makeLeft({
              kind: 'invalidExpression',
              message: `lookup key must be an atom, got \`${stringifySemanticGraphForEndUser(
                asSemanticGraph(key),
              )}\``,
            })
          } else {
            return either.makeRight(makeLookupExpression(key))
          }
        },
      )
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not an expression',
      })

export const makeLookupExpression = (key: Atom): LookupExpression =>
  makeObjectNode({
    0: '@lookup',
    key,
  })
