const read = async (stream: AsyncIterable<string>): Promise<string> => {
  let source: string = ''
  for await (const chunk of stream) {
    source += chunk
  }
  return source
}

const main = async (process: NodeJS.Process): Promise<undefined> => {
  process.stdout.write(await read(process.stdin))
}

await main(process)
