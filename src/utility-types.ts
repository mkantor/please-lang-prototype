export type JSONArray = readonly JSONValue[]
export type JSONRecord = { readonly [key: string]: JSONValue }
export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONArray
  | JSONRecord

export type Writable<T> = { -readonly [P in keyof T]: T[P] }
