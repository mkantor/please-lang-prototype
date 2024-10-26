import type { Either } from '../../adts/either.js'
import * as either from '../../adts/either.js'
import * as option from '../../adts/option.js'
import { withPhantomData, type WithPhantomData } from '../../phantom-data.js'
import type { Writable } from '../../utility-types.js'
import type { SyntaxTree } from '../compiler.js'
import type { ElaborationError, InvalidSyntaxError } from '../errors.js'
import type { Atom } from '../parsing/atom.js'
import type { Molecule } from '../parsing/molecule.js'
import type { Canonicalized, Elaborated } from '../stages.js'
import {
  isKeyword,
  keywordTransforms,
  type ExpressionContext,
} from './keywords.js'
import {
  literalMoleculeToObjectNode,
  literalValueToSemanticGraph,
  makeAtomNode,
  semanticGraphToSyntaxTree,
  type AtomNode,
  type SemanticGraph,
} from './semantic-graph.js'

export type ElaboratedValue = WithPhantomData<SemanticGraph, Elaborated>

export const elaborate = (
  program: SyntaxTree,
): Either<ElaborationError, ElaboratedValue> =>
  either.map(
    typeof program === 'string'
      ? handleAtomWhichMayNotBeAKeyword(program)
      : elaborateWithinMolecule(program, {
          location: [],
          program: literalMoleculeToObjectNode(program),
        }),
    withPhantomData<Elaborated>(),
  )

const elaborateWithinMolecule = (
  molecule: Molecule,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> => {
  let possibleKeywordCallAsMolecule: Writable<Molecule> = {}
  for (let [key, value] of Object.entries(molecule)) {
    const keyUpdateResult = handleAtomWhichMayNotBeAKeyword(key)
    if (either.isLeft(keyUpdateResult)) {
      // Immediately bail on error.
      return keyUpdateResult
    } else {
      const updatedKey = keyUpdateResult.value
      if (typeof value === 'string') {
        possibleKeywordCallAsMolecule[updatedKey.atom] = value
      } else {
        const result = elaborateWithinMolecule(value, {
          location: [...context.location, key],
          program: context.program,
        })
        if (either.isLeft(result)) {
          // Immediately bail on error.
          return result
        }
        possibleKeywordCallAsMolecule[updatedKey.atom] =
          semanticGraphToSyntaxTree(result.value)
      }
    }
  }

  const { 0: possibleKeyword, ...propertiesInNeedOfFinalization } =
    possibleKeywordCallAsMolecule

  // At this point `possibleKeywordCallAsMolecule` may still have raw escape sequences at the top
  // level (whether it is a keyword call or not).
  for (let [key, value] of Object.entries(propertiesInNeedOfFinalization)) {
    if (typeof value === 'string') {
      const valueUpdateResult = handleAtomWhichMayNotBeAKeyword(value)
      if (either.isLeft(valueUpdateResult)) {
        // Immediately bail on error.
        return valueUpdateResult
      } else {
        const updatedValue = valueUpdateResult.value
        possibleKeywordCallAsMolecule[key] =
          semanticGraphToSyntaxTree(updatedValue)
      }
    }
  }

  if (typeof possibleKeywordCallAsMolecule['0'] === 'string') {
    return handleMoleculeWhichMayBeAKeywordCall(
      {
        0: possibleKeywordCallAsMolecule['0'],
        ...possibleKeywordCallAsMolecule,
      },
      context,
    )
  } else {
    // The input was actually just a literal object, not a keyword call.
    return either.makeRight(
      literalMoleculeToObjectNode(possibleKeywordCallAsMolecule),
    )
  }
}

const handleMoleculeWhichMayBeAKeywordCall = (
  { 0: possibleKeyword, ...possibleArguments }: Molecule & { readonly 0: Atom },
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  option.match(option.fromPredicate(possibleKeyword, isKeyword), {
    none: () =>
      /^@[^@]/.test(possibleKeyword)
        ? either.makeLeft({
            kind: 'unknownKeyword',
            message: `unknown keyword: \`${possibleKeyword}\``,
          })
        : either.makeRight(
            literalValueToSemanticGraph(
              withPhantomData<Canonicalized>()({
                ...possibleArguments,
                0: unescapeKeywordSigil(possibleKeyword),
              }),
            ),
          ),
    some: keyword =>
      keywordTransforms[keyword](
        literalMoleculeToObjectNode(possibleArguments),
        context,
      ),
  })

const handleAtomWhichMayNotBeAKeyword = (
  atom: Atom,
): Either<InvalidSyntaxError, AtomNode> => {
  if (/^@[^@]/.test(atom)) {
    return either.makeLeft({
      kind: 'invalidSyntax',
      message: `keywords cannot be used here: ${atom}`,
    })
  } else {
    return either.makeRight(makeAtomNode(unescapeKeywordSigil(atom)))
  }
}

const unescapeKeywordSigil = (value: string) =>
  /^@@/.test(value) ? value.substring(1) : value
