import either, { type Either } from '@matt.kantor/either'
import { withPhantomData } from '../../../phantom-data.js'
import { testCases } from '../../../test-utilities.test.js'
import type { Writable } from '../../../utility-types.js'
import type { ElaborationError } from '../../errors.js'
import type { Atom, Molecule } from '../../parsing.js'
import {
  elaborate,
  makeObjectNode,
  type ElaboratedSemanticGraph,
  type ObjectNode,
} from '../../semantics.js'
import type { SemanticGraph } from '../../semantics/semantic-graph.js'
import { keywordHandlers } from './keywords.js'

export const elaborationSuite = testCases(
  (input: Atom | Molecule) =>
    elaborate(withPhantomData<never>()(input), keywordHandlers),
  input => `elaborating \`${JSON.stringify(input)}\``,
)

export const success = (
  expectedOutput: Atom | Molecule,
): Either<ElaborationError, ElaboratedSemanticGraph> =>
  either.makeRight(
    withPhantomData<never>()(
      typeof expectedOutput === 'string' ? expectedOutput : (
        literalMoleculeToObjectNode(expectedOutput)
      ),
    ),
  )

const literalMoleculeToObjectNode = (molecule: Molecule): ObjectNode => {
  const properties: Writable<Record<string, SemanticGraph>> = {}
  for (const [key, propertyValue] of Object.entries(molecule)) {
    properties[key] =
      typeof propertyValue === 'string' ? propertyValue : (
        literalMoleculeToObjectNode(propertyValue)
      )
  }
  return makeObjectNode(properties)
}
