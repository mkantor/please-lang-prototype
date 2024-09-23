const read = async (stream: AsyncIterable<string>): Promise<string> => {
  let input: string = ''
  for await (const chunk of stream) {
    input += chunk
  }
  return input
}

const main = async (process: NodeJS.Process): Promise<undefined> => {
  process.stdout.write(await read(process.stdin))
}

await main(process)
