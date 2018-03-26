"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const monitor_dao_1 = require("./monitor-dao");
const vineyard_blockchain_1 = require("vineyard-blockchain");
const profiler_1 = require("./utility/profiler");
const block_queue_1 = require("./block-queue");
function saveSingleCurrencyBlock(blockCollection, block) {
    return __awaiter(this, void 0, void 0, function* () {
        const existing = yield blockCollection.first({ index: block.index });
        if (existing)
            return;
        yield blockCollection.create(block);
    });
}
exports.saveSingleCurrencyBlock = saveSingleCurrencyBlock;
function getTransactionByTxid(transactionCollection, txid) {
    return transactionCollection.first({ txid: txid }).exec();
}
exports.getTransactionByTxid = getTransactionByTxid;
function getOrCreateAddressReturningId(addressCollection, externalAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        const internalAddress = yield addressCollection.first({ address: externalAddress });
        return internalAddress
            ? internalAddress.id
            : (yield addressCollection.create({ address: externalAddress })).id;
    });
}
exports.getOrCreateAddressReturningId = getOrCreateAddressReturningId;
function createSingleCurrencyTransactionDao(model) {
    return {
        getTransactionByTxid: getTransactionByTxid.bind(null, model.Transaction),
        saveTransaction: (transaction) => __awaiter(this, void 0, void 0, function* () {
            yield model.Transaction.create(transaction);
        }),
        setStatus: monitor_dao_1.setStatus.bind(null, model.Transaction)
    };
}
exports.createSingleCurrencyTransactionDao = createSingleCurrencyTransactionDao;
function createEthereumExplorerDao(model) {
    return {
        blockDao: {
            saveBlock: (block) => saveSingleCurrencyBlock(model.Block, block)
        },
        lastBlockDao: monitor_dao_1.createIndexedLastBlockDao(model.ground, 2),
        // transactionDao: createSingleCurrencyTransactionDao(model),
        getOrCreateAddress: (externalAddress) => getOrCreateAddressReturningId(model.Address, externalAddress),
        ground: model.ground
    };
}
exports.createEthereumExplorerDao = createEthereumExplorerDao;
function getNextBlock(lastBlockDao) {
    return __awaiter(this, void 0, void 0, function* () {
        const lastBlockIndex = yield lastBlockDao.getLastBlock();
        return typeof lastBlockIndex === 'number' ? lastBlockIndex + 1 : 0;
    });
}
exports.getNextBlock = getNextBlock;
function gatherAddresses(blocks, contracts, tokenTransfers) {
    const addresses = {};
    for (let block of blocks) {
        for (let transaction of block.transactions) {
            if (transaction.to)
                addresses[transaction.to] = -1;
            if (transaction.from)
                addresses[transaction.from] = -1;
        }
    }
    for (let contract of contracts) {
        addresses[contract.address] = -1;
    }
    for (let transfer of tokenTransfers) {
        addresses[transfer.decoded.args.to] = -1;
        addresses[transfer.decoded.args.from] = -1;
    }
    return addresses;
}
function setAddress(getOrCreateAddress, addresses, key) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = yield getOrCreateAddress(key);
        addresses[key] = id;
    });
}
function saveTransactions(ground, blocks, addresses) {
    let transactionClauses = [];
    const header = 'INSERT INTO "transactions" ("status", "txid", "to", "from", "amount", "fee", "nonce", "currency", "timeReceived", "blockIndex", "created", "modified") VALUES\n';
    for (let block of blocks) {
        transactionClauses = transactionClauses.concat(block.transactions.map(t => {
            const to = t.to ? addresses[t.to] : 'NULL';
            const from = t.from ? addresses[t.from] : 'NULL';
            return `(${t.status}, '${t.txid}', ${to}, ${from}, ${t.amount}, ${t.fee}, ${t.nonce}, 2, '${t.timeReceived.toISOString()}', ${t.blockIndex}, NOW(), NOW())`;
        }));
    }
    if (transactionClauses.length == 0)
        return Promise.resolve();
    const sql = header + transactionClauses.join(',\n') + ' ON CONFLICT DO NOTHING;';
    return ground.querySingle(sql);
}
function getOrCreateAddresses(ground, addresses) {
    return __awaiter(this, void 0, void 0, function* () {
        {
            const addressClauses = [];
            for (let i in addresses) {
                addressClauses.push(`'${i}'`);
            }
            if (addressClauses.length == 0)
                return Promise.resolve();
            const header = `SELECT "id", "address" FROM addresses
  WHERE "address" IN (
  `;
            const sql = header + addressClauses.join(',\n') + ');';
            const rows = yield ground.query(sql);
            for (let row of rows) {
                addresses[row.address] = parseInt(row.id);
            }
        }
        {
            const inserts = [];
            for (let i in addresses) {
                const value = addresses[i];
                if (value === -1) {
                    inserts.push(`('${i}', NOW(), NOW())`);
                }
            }
            if (inserts.length == 0)
                return Promise.resolve();
            const insertHeader = 'INSERT INTO "addresses" ("address", "created", "modified") VALUES\n';
            const sql = insertHeader + inserts.join(',\n') + ' ON CONFLICT DO NOTHING RETURNING "id", "address";';
            const rows = yield ground.query(sql);
            for (let row of rows) {
                addresses[row.address] = parseInt(row.id);
            }
        }
    });
}
function saveBlocks(ground, blocks) {
    return __awaiter(this, void 0, void 0, function* () {
        const header = 'INSERT INTO "blocks" ("index", "hash", "timeMined", "created", "modified") VALUES\n';
        let inserts = [];
        for (let block of blocks) {
            inserts.push(`(${block.index}, '${block.hash}', '${block.timeMined.toISOString()}', NOW(), NOW())`);
        }
        const sql = header + inserts.join(',\n') + ' ON CONFLICT DO NOTHING;';
        return ground.querySingle(sql);
    });
}
function saveCurrencies(ground, tokenContracts) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = [];
        for (let contract of tokenContracts) {
            const token = contract;
            const record = yield ground.collections.Currency.create({
                name: token.name
            });
            result.push({
                currency: record,
                tokenContract: token
            });
        }
        return result;
        // let i = 1
        // const values: any = {}
        // const tokenClauses: string[] = tokenContracts.map(contract => {
        //     const token = contract as blockchain.TokenContract
        //     const key = 'name' + i++
        //     values[key] = token.name
        //     return `(:${key}, NOW(), NOW())`
        //   }
        // )
        // return result.map((c: any) => ({
        //   id: parseInt(c.id),
        //   name: c.name
        // }))
    });
}
function saveContracts(ground, contracts, addresses) {
    return __awaiter(this, void 0, void 0, function* () {
        if (contracts.length == 0)
            return Promise.resolve();
        const contractClauses = contracts.map(contract => `(${addresses[contract.address]}, (SELECT transactions.id FROM transactions WHERE txid = '${contract.txid}'), NOW(), NOW())`);
        const header = 'INSERT INTO "contracts" ("address", "transaction", "created", "modified") VALUES\n';
        const sql = header + contractClauses.join(',\n') + ' ON CONFLICT DO NOTHING RETURNING "id", "address";';
        const contractRecords = (yield ground.query(sql))
            .map((c) => ({
            id: parseInt(c.id),
            address: parseInt(c.address)
        }));
        const tokenContracts = contracts.filter(c => c.contractType == vineyard_blockchain_1.blockchain.ContractType.token);
        if (tokenContracts.length == 0)
            return;
        const currencyContracts = yield saveCurrencies(ground, tokenContracts);
        for (const bundle of currencyContracts) {
            const token = bundle.tokenContract;
            const address = addresses[token.address];
            const contractRecord = contractRecords.filter((c) => c.address === address)[0];
            if (!contractRecord)
                continue;
            const currency = bundle.currency;
            ground.collections.Token.create({
                id: currency.id,
                contract: contractRecord.id,
                name: token.name,
                totalSupply: token.totalSupply,
                decimals: token.decimals.toNumber(),
                version: token.version,
                symbol: token.symbol
            });
        }
        //   {
        //     let i = 1
        //     const values: any = {}
        //     const tokenClauses: string[] = currencyContracts.map(bundle => {
        //         const token = bundle.tokenContract
        //         const address = addresses[token.address]
        //         const contractRecord = contractRecords.filter((c: any) => c.address === address)[0]
        //         const currency = bundle.currency
        //         const nameKey = 'name' + i++
        //         values[nameKey] = token.name
        //         return `(${currency.id}, ${contractRecord.id}, :${nameKey}, '${token.totalSupply}', '${token.decimals}',
        //       '${token.version}', '${token.symbol}', NOW(), NOW())`
        //       }
        //     )
        //
        //     const sql2 = `
        // INSERT INTO "tokens" ("id", "contract", "name", "totalSupply", "decimals", "version", "symbol", "created", "modified")
        // VALUES ${tokenClauses.join(',\n')}
        // ON CONFLICT DO NOTHING;`
        //
        //     await ground.querySingle(sql2, values)
        //   }
    });
}
function gatherNewContracts(blocks) {
    let result = [];
    for (let block of blocks) {
        result = result.concat(block.transactions
            .filter(t => t.newContract)
            .map(t => t.newContract));
    }
    return result;
}
function gatherTokenTranferInfo(ground, pairs) {
    return __awaiter(this, void 0, void 0, function* () {
        if (pairs.length == 0)
            return Promise.resolve([]);
        const addressClause = pairs.map(c => `('${c.address}', '${c.txid}')`).join(',\n');
        const sql = `
  SELECT 
    contracts.id AS "contractId",
    addresses.id AS "addressId", 
    addresses.address,
    tokens.id AS "tokenId",
    infos.column2 AS txid
  FROM addresses
  JOIN contracts ON contracts.address = addresses.id
  JOIN tokens ON tokens.contract = contracts.id
  JOIN (VALUES
  ${addressClause}
  ) infos
ON infos.column1 = addresses.address`;
        const records = yield ground.query(sql);
        return records.map(r => ({
            address: r.address,
            contractId: parseInt(r.contractId),
            tokenId: parseInt(r.tokenId),
            txid: r.txid
        }));
    });
}
function gatherTokenTransfers(ground, decodeEvent, events) {
    return __awaiter(this, void 0, void 0, function* () {
        let contractTransactions = events.map(e => ({ address: e.address, txid: e.transactionHash }));
        const infos = yield gatherTokenTranferInfo(ground, contractTransactions);
        return infos.map(info => {
            const event = events.filter(event => event.transactionHash == info.txid)[0];
            const decoded = decodeEvent(event);
            return {
                original: event,
                decoded: decoded,
                info: info
            };
        });
    });
}
// async function gatherContractTransactions(ground: Modeler, tokenTransfers: TokenTransferBundle[]): Promise<ContractInfo[]> {
//   const transactionClause = tokenTransfers.map(b => "'" + b.info.txid + "'").join(',\n')
//   const sql = `
//   SELECT
//     transactions.status AS "transactionStatus",
//     transactions."timeReceived",
//     transactions.id AS "transactionId",
//     transactions."blockIndex",
//     transactions.txid
//   FROM transactions
//   WHERE transactions.txid IN (
//   ${transactionClause}
//   )`
//   const records: any[] = await ground.query(sql)
//   return records.map(r => ({
//     blockIndex: r.blockIndex,
//     timeReceived: r.timeReceived,
//     transactionId: parseInt(r.transactionId),
//     transactionStatus: r.transactionStatus,
//     txid: r.txid
//   }))
// }
function saveTokenTransfers(ground, tokenTransfers, addresses) {
    return __awaiter(this, void 0, void 0, function* () {
        if (tokenTransfers.length == 0)
            return Promise.resolve();
        // const txs = await gatherContractTransactions(ground, tokenTransfers)
        const header = 'INSERT INTO "token_transfers" ("status", "transaction", "to", "from", "amount", "currency", "created", "modified") VALUES\n';
        const transactionClauses = tokenTransfers.map(bundle => {
            const to = addresses[bundle.decoded.args.to];
            const from = addresses[bundle.decoded.args.from];
            return `(0, (SELECT tx.id FROM transactions tx WHERE tx.txid = '${bundle.info.txid}'), ${to}, ${from}, ${bundle.decoded.args.value.toString()}, ${bundle.info.tokenId}, NOW(), NOW())`;
        });
        const sql = header + transactionClauses.join(',\n') + ' ON CONFLICT DO NOTHING;';
        return ground.querySingle(sql);
    });
}
function flatMap(array, mapper) {
    return array.reduce((accumulator, a) => accumulator.concat(mapper(a)), []);
}
function saveFullBlocks(dao, decodeTokenTransfer, blocks) {
    return __awaiter(this, void 0, void 0, function* () {
        const ground = dao.ground;
        const transactions = flatMap(blocks, b => b.transactions);
        const events = flatMap(transactions, t => t.events || []);
        const tokenTranfers = yield gatherTokenTransfers(ground, decodeTokenTransfer, events);
        const contracts = gatherNewContracts(blocks);
        const addresses = gatherAddresses(blocks, contracts, tokenTranfers);
        const lastBlockIndex = blocks.sort((a, b) => b.index - a.index)[0].index;
        yield Promise.all([
            saveBlocks(ground, blocks),
            dao.lastBlockDao.setLastBlock(lastBlockIndex),
            getOrCreateAddresses(dao.ground, addresses)
                .then(() => saveTransactions(ground, blocks, addresses))
                .then(() => saveContracts(ground, contracts, addresses))
                .then(() => saveTokenTransfers(ground, tokenTranfers, addresses))
        ]);
        console.log('Saved blocks; count', blocks.length, 'last', lastBlockIndex);
    });
}
function scanEthereumExplorerBlocks(dao, client, decodeTokenTransfer, config, profiler = new profiler_1.EmptyProfiler()) {
    return __awaiter(this, void 0, void 0, function* () {
        let blockIndex = yield getNextBlock(dao.lastBlockDao);
        const blockQueue = new block_queue_1.ExternalBlockQueue(client, blockIndex, config.maxConsecutiveBlocks);
        const startTime = Date.now();
        do {
            const elapsed = Date.now() - startTime;
            // console.log('Scanning block', blockIndex, 'elapsed', elapsed)
            if (config.maxMilliseconds && elapsed > config.maxMilliseconds) {
                console.log('Reached timeout of ', elapsed, 'milliseconds');
                console.log('Canceled blocks', blockQueue.requests.map(b => b.blockIndex).join(', '));
                break;
            }
            profiler.start('getBlocks');
            const blocks = yield blockQueue.getBlocks();
            profiler.stop('getBlocks');
            if (blocks.length == 0) {
                console.log('No more blocks found.');
                break;
            }
            console.log('Saving blocks', blocks.map(b => b.index).join(', '));
            profiler.start('saveBlocks');
            yield saveFullBlocks(dao, decodeTokenTransfer, blocks);
            profiler.stop('saveBlocks');
            // console.log('Saved blocks', blocks.map(b => b.index))
        } while (true);
    });
}
exports.scanEthereumExplorerBlocks = scanEthereumExplorerBlocks;
//# sourceMappingURL=ethereum-explorer.js.map