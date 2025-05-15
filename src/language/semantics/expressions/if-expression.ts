import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Molecule } from '../../parsing.js'
import { isExpressionWithArgument } from '../expression.js'
import { makeObjectNode, type ObjectNode } from '../object-node.js'
import { type SemanticGraph } from '../semantic-graph.js'
import { readArgumentsFromExpression } from './expression-utilities.js'

// TODO: Evolve this into pattern matching/destructuring.
export type IfExpression = ObjectNode & {
  readonly 0: '@if'
  readonly 1: {
    readonly condition: SemanticGraph | Molecule
    readonly then: SemanticGraph | Molecule
    readonly else: SemanticGraph | Molecule
  }
}

export const readIfExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, IfExpression> =>
  isExpressionWithArgument('@if', node)
    ? either.map(
        readArgumentsFromExpression(node, ['condition', 'then', 'else']),
        ([condition, then, otherwise]) =>
          makeIfExpression({ condition, then, else: otherwise }),
      )
    : either.makeLeft({
        kind: 'invalidExpression',
        message: 'not an expression',
      })

export const makeIfExpression = ({
  condition,
  then,
  else: otherwise,
}: {
  readonly condition: SemanticGraph | Molecule
  readonly then: SemanticGraph | Molecule
  readonly else: SemanticGraph | Molecule
}): IfExpression =>
  makeObjectNode({
    0: '@if',
    1: makeObjectNode({
      condition,
      then,
      else: otherwise,
    }),
  })
