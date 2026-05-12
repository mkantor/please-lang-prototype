import either, { type Either } from '@matt.kantor/either'
import { withPhantomData } from '../../../phantom-data.js'
import { testCases } from '../../../test-utilities.test.js'
import type { JsonValue, Writable } from '../../../utility-types.js'
import type { ElaborationError } from '../../errors.js'
import { canonicalize, type Molecule } from '../../parsing.js'
import {
  elaborate,
  makeObjectNode,
  type ElaboratedSemanticGraph,
  type ObjectNode,
} from '../../semantics.js'
import type { SemanticGraph } from '../../semantics/semantic-graph.js'
import { keywordHandlers } from './keywords.js'

export const elaborationSuite = testCases(
  (input: JsonValue) => elaborate(canonicalize(input), keywordHandlers),
  input => `elaborating \`${JSON.stringify(input)}\``,
)

export const success = (
  expectedOutput: JsonValue,
): Either<ElaborationError, ElaboratedSemanticGraph> => {
  const canonicalized = canonicalize(expectedOutput)
  return either.makeRight(
    withPhantomData<never>()(
      typeof canonicalized === 'string' ? canonicalized : (
        literalMoleculeToObjectNode(canonicalized)
      ),
    ),
  )
}

const literalMoleculeToObjectNode = (molecule: Molecule): ObjectNode => {
  const properties: Writable<Record<string, SemanticGraph>> = {}
  for (const [key, propertyValue] of molecule.entries) {
    properties[key] =
      typeof propertyValue === 'string' ? propertyValue : (
        literalMoleculeToObjectNode(propertyValue)
      )
  }
  return makeObjectNode(properties)
}
