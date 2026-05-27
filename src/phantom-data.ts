declare const _thisPropertyDoesNotExistAtRuntime: unique symbol
export type WithPhantomData<Value, PhantomData> = Value & {
  readonly [_thisPropertyDoesNotExistAtRuntime]: PhantomData
}

export const withPhantomData =
  <Data>() =>
  <Value>(value: Value): WithPhantomData<Value, Data> =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    value as WithPhantomData<Value, Data>
