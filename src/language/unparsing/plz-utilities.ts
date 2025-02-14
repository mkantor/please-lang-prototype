import either, { type Either, type Right } from '@matt.kantor/either'
import parsing from '@matt.kantor/parsing'
import kleur from 'kleur'
import type { UnserializableValueError } from '../errors.js'
import type { Atom, Molecule } from '../parsing.js'
import { unquotedAtomParser } from '../parsing/atom.js'
import {
  isSemanticGraph,
  readApplyExpression,
  readFunctionExpression,
  readLookupExpression,
  serialize,
  type ApplyExpression,
  type FunctionExpression,
  type LookupExpression,
  type SemanticGraph,
} from '../semantics.js'

export const dot = kleur.dim('.')
export const quote = kleur.dim('"')
export const colon = kleur.dim(':')
export const comma = kleur.dim(',')
export const openBrace = kleur.dim('{')
export const closeBrace = kleur.dim('}')
export const openParenthesis = kleur.dim('(')
export const closeParenthesis = kleur.dim(')')
export const arrow = kleur.dim('=>')

export const moleculeUnparser =
  (
    unparseAtomOrMolecule: UnparseAtomOrMolecule,
    unparseSugarFreeMolecule: (
      expression: Molecule,
      unparseAtomOrMolecule: UnparseAtomOrMolecule,
    ) => Either<UnserializableValueError, string>,
  ) =>
  (value: Molecule): Either<UnserializableValueError, string> => {
    const functionExpressionResult = readFunctionExpression(value)
    if (!either.isLeft(functionExpressionResult)) {
      return unparseSugaredFunction(
        functionExpressionResult.value,
        unparseAtomOrMolecule,
      )
    } else {
      const applyExpressionResult = readApplyExpression(value)
      if (!either.isLeft(applyExpressionResult)) {
        return unparseSugaredApply(
          applyExpressionResult.value,
          unparseAtomOrMolecule,
        )
      } else {
        const lookupExpressionResult = readLookupExpression(value)
        if (!either.isLeft(lookupExpressionResult)) {
          return unparseSugaredLookup(
            lookupExpressionResult.value,
            unparseAtomOrMolecule,
          )
        } else {
          return unparseSugarFreeMolecule(value, unparseAtomOrMolecule)
        }
      }
    }
  }

export const moleculeAsKeyValuePairStrings = (
  value: Molecule,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
  options: { readonly ordinalKeys: 'omit' | 'preserve' },
): Either<UnserializableValueError, readonly string[]> => {
  const entries = Object.entries(value)

  const keyValuePairsAsStrings: string[] = []
  let ordinalPropertyKeyCounter = 0n
  for (const [propertyKey, propertyValue] of entries) {
    const valueAsStringResult = unparseAtomOrMolecule(propertyValue)
    if (either.isLeft(valueAsStringResult)) {
      return valueAsStringResult
    }

    // Omit ordinal property keys:
    if (
      propertyKey === String(ordinalPropertyKeyCounter) &&
      options.ordinalKeys === 'omit'
    ) {
      keyValuePairsAsStrings.push(valueAsStringResult.value)
      ordinalPropertyKeyCounter += 1n
    } else {
      keyValuePairsAsStrings.push(
        kleur
          .cyan(quoteIfNecessary(propertyKey).concat(colon))
          .concat(' ')
          .concat(valueAsStringResult.value),
      )
    }
  }
  return either.makeRight(keyValuePairsAsStrings)
}

export const unparseAtom = (atom: string): Right<string> =>
  either.makeRight(
    /^@[^@]/.test(atom)
      ? kleur.bold(kleur.underline(quoteIfNecessary(atom)))
      : quoteIfNecessary(atom),
  )

const quoteIfNecessary = (value: string): string => {
  const unquotedAtomResult = parsing.parse(unquotedAtomParser, value)
  if (either.isLeft(unquotedAtomResult)) {
    return quote.concat(escapeStringContents(value)).concat(quote)
  } else {
    return value
  }
}

const serializeIfNeeded = (
  nodeOrMolecule: SemanticGraph | Molecule,
): Either<UnserializableValueError, Atom | Molecule> =>
  isSemanticGraph(nodeOrMolecule)
    ? serialize(nodeOrMolecule)
    : either.makeRight(nodeOrMolecule)

type UnparseAtomOrMolecule = (
  value: Atom | Molecule,
) => Either<UnserializableValueError, string>

const escapeStringContents = (value: string) =>
  value.replace('\\', '\\\\').replace('"', '\\"')

const unparseSugaredApply = (
  expression: ApplyExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) => {
  const functionUnparseResult = either.map(
    either.flatMap(
      serializeIfNeeded(expression.function),
      unparseAtomOrMolecule,
    ),
    unparsedFunction =>
      either.isRight(readFunctionExpression(expression.function))
        ? // Immediately-applied function expressions need parentheses.
          openParenthesis.concat(unparsedFunction).concat(closeParenthesis)
        : unparsedFunction,
  )
  if (either.isLeft(functionUnparseResult)) {
    return functionUnparseResult
  }

  const argumentUnparseResult = either.flatMap(
    serializeIfNeeded(expression.argument),
    unparseAtomOrMolecule,
  )
  if (either.isLeft(argumentUnparseResult)) {
    return argumentUnparseResult
  }

  return either.makeRight(
    functionUnparseResult.value
      .concat(openParenthesis)
      .concat(argumentUnparseResult.value)
      .concat(closeParenthesis),
  )
}

const unparseSugaredFunction = (
  expression: FunctionExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) =>
  either.flatMap(serializeIfNeeded(expression.body), serializedBody =>
    either.map(unparseAtomOrMolecule(serializedBody), bodyAsString =>
      [kleur.cyan(expression.parameter), arrow, bodyAsString].join(' '),
    ),
  )

const unparseSugaredLookup = (
  expression: LookupExpression,
  unparseAtomOrMolecule: UnparseAtomOrMolecule,
) =>
  either.map(unparseAtomOrMolecule(expression.key), key =>
    kleur.cyan(colon.concat(key)),
  )
