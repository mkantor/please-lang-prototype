export const isKeyword = (input: string) =>
  input === '@apply' ||
  input === '@check' ||
  input === '@function' ||
  input === '@index' ||
  input === '@lookup' ||
  input === '@runtime' ||
  input === '@todo'

export type Keyword = typeof isKeyword extends (
  input: string,
) => input is string & infer Keyword
  ? Keyword
  : never
