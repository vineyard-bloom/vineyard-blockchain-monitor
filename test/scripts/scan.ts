require('source-map-support').install()
import { createVillage } from "../src/village";
import { startEthereumMonitor } from "../src/ethereum-explorer-service";

async function initialize(model: any) {
  await (model.ground as any).regenerate()
  await model.Currency.create({ name: 'Bitcoin' })
  await model.Currency.create({ name: 'Ethereum' })
  // await model.LastBlock.create({ currency: 2, blockIndex: 46401 })
  await model.LastBlock.create({ currency: 2 })
}

async function main() {
  const village = await createVillage()
  const model = village.model
  // await initialize(model)
  console.log('Initialized village')
  await startEthereumMonitor(village, {
    maxConsecutiveBlocks: 10,
    // maxMilliseconds: 30000,
  })
}

main()