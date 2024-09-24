import * as util from 'node:util'

const read = async (stream: AsyncIterable<string>): Promise<string> => {
  let input: string = ''
  for await (const chunk of stream) {
    input += chunk
  }
  return input
}

const main = async (process: NodeJS.Process): Promise<undefined> => {
  const rawInput = await read(process.stdin)
  const parsedInput: unknown = JSON.parse(rawInput)

  process.stdout.write(
    util.inspect(parsedInput, {
      colors: true,
      depth: Infinity,
    }),
  )

  // Writing a newline ensures that output is flushed before exiting. Otherwise there may be no
  // output actually printed to the console. This happens whether or not `process.exit` is
  // explicitly called. See:
  //  - <https://github.com/nodejs/node/issues/6379>
  //  - <https://github.com/nodejs/node/issues/6456>
  //  - <https://github.com/nodejs/node/issues/2972>
  //  - …and many other near-duplicate issues
  //
  // I've tried other workarounds such as passing a callback to `process.stdout.write` and ensuring
  // the returned `Promise` is not resolved until it is called, explicitly calling
  // calling `process.stdout.end` and/or `process.stdout.uncork`, etc and so far this is the only
  // one that reliably results in the desired behavior.
  process.stdout.write('\n')
}

await main(process)
