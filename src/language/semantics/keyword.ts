export const isExemptFromElaboration = (input: Keyword) => input === '@union' || input === '@signature'

export const isKeyword = (input: string) =>
  input === '@apply' ||
  input === '@check' ||
  input === '@function' ||
  input === '@if' ||
  input === '@index' ||
  input === '@lookup' ||
  input === '@panic' ||
  input === '@runtime' ||
  input === '@signature' ||
  input === '@todo' ||
  input === '@union'

export type Keyword =
  typeof isKeyword extends (input: string) => input is string & infer Keyword ?
    Keyword
  : never
