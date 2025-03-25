import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Molecule } from '../../parsing.js'
import { isSpecificExpression } from '../expression.js'
import { makeObjectNode, type ObjectNode } from '../object-node.js'
import { type SemanticGraph } from '../semantic-graph.js'
import { readArgumentsFromExpression } from './expression-utilities.js'

// TODO: Evolve this into pattern matching/destructuring.
export type IfExpression = ObjectNode & {
  readonly 0: '@if'
  readonly condition: SemanticGraph | Molecule
  readonly then: SemanticGraph | Molecule
  readonly else: SemanticGraph | Molecule
}

export const readIfExpression = (
  node: SemanticGraph | Molecule,
): Either<ElaborationError, IfExpression> =>
  isSpecificExpression('@if', node)
    ? either.map(
        readArgumentsFromExpression(node, [
          ['condition', '1'],
          ['then', '2'],
          ['else', '3'],
        ]),
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
    condition,
    then,
    else: otherwise,
  })
