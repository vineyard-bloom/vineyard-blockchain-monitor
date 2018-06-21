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
                addresses[row.address.trim()] = parseInt(row.id);
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
                addresses[row.address.trim()] = parseInt(row.id);
            }
        }
    });
}
exports.getOrCreateAddresses = getOrCreateAddresses;
function getOrCreateAddresses2(ground, addresses) {
    return __awaiter(this, void 0, void 0, function* () {
        const existingAddresses = yield getExistingAddresses(ground, addresses);
        const newlySavedAddresses = yield saveNewAddresses(ground, arrayDiff(addresses, Object.keys(existingAddresses)));
        return Object.assign({}, existingAddresses, newlySavedAddresses);
    });
}
exports.getOrCreateAddresses2 = getOrCreateAddresses2;
function getExistingAddresses(ground, addresses) {
    return __awaiter(this, void 0, void 0, function* () {
        const addressMap = {};
        if (addresses.length === 0)
            return addressMap;
        const header = `SELECT "id", "address" FROM addresses WHERE "address" IN (`;
        const sql = header + addresses.map(add => `'${add}'`).join(',\n') + ');';
        const rows = yield ground.query(sql);
        for (let row of rows) {
            addressMap[row.address.trim()] = parseInt(row.id);
        }
        return addressMap;
    });
}
exports.getExistingAddresses = getExistingAddresses;
function saveNewAddresses(ground, addresses) {
    return __awaiter(this, void 0, void 0, function* () {
        const addressMap = {};
        if (addresses.length === 0)
            return addressMap;
        const inserts = addresses.map(add => `('${add}', NOW(), NOW())`);
        const insertHeader = 'INSERT INTO "addresses" ("address", "created", "modified") VALUES\n';
        const sql = insertHeader + inserts.join(',\n') + ' ON CONFLICT DO NOTHING RETURNING "id", "address";';
        const rows = yield ground.query(sql);
        for (let row of rows) {
            addressMap[row.address.trim()] = parseInt(row.id);
        }
        return addressMap;
    });
}
exports.saveNewAddresses = saveNewAddresses;
function arrayDiff(a1, a2) {
    const set2 = new Set(a2);
    return a1.filter(x => !set2.has(x));
}
exports.arrayDiff = arrayDiff;
function saveBlocks(ground, blocks) {
    return __awaiter(this, void 0, void 0, function* () {
        if (blocks.length === 0) {
            throw new Error('blocks array must not be empty');
        }
        const header = 'INSERT INTO "blocks" ("index", "hash", "timeMined", "bloom", "coinbase", "difficulty", "extraData", "gasLimit", "parentHash", "receiptTrie", "stateRoot", "transactionsTrie", "rlp", "created",  "modified") VALUES\n';
        let inserts = [];
        for (let block of blocks) {
            inserts.push(`(${block.index}, '${block.hash}', '${block.timeMined.toISOString()}', '${block.bloom}', '${block.coinbase}', '${block.difficulty}', '${block.extraData}', '${block.gasLimit}', '${block.parentHash}', '${block.receiptTrie}', '${block.stateRoot}', '${block.transactionsTrie}', '${block.rlp}', NOW(), NOW())`);
        }
        const sql = header + inserts.join(',\n') + ' ON CONFLICT DO NOTHING;';
        return ground.querySingle(sql);
    });
}
exports.saveBlocks = saveBlocks;
function saveCurrencies(ground, tokenContracts) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = [];
        for (let contract of tokenContracts) {
            if (!contract.name) {
                throw new Error('Contract is missing name property');
            }
            const record = yield ground.collections.Currency.create({
                name: contract.name
            });
            result.push({
                currency: record,
                tokenContract: contract
            });
        }
        return result;
    });
}
exports.saveCurrencies = saveCurrencies;
function getNextBlock(lastBlockDao) {
    return __awaiter(this, void 0, void 0, function* () {
        const lastBlockIndex = yield lastBlockDao.getLastBlock();
        return typeof lastBlockIndex === 'number' ? lastBlockIndex + 1 : 0;
    });
}
exports.getNextBlock = getNextBlock;
function saveSingleTransactions(ground, transactions, addresses) {
    const header = 'INSERT INTO "transactions" ("status", "txid", "to", "from", "amount", "fee", "nonce", "currency", "timeReceived", "blockIndex", "created", "modified") VALUES\n';
    const transactionClauses = transactions.map(t => {
        const to = t.to ? addresses[t.to] : 'NULL';
        const from = t.from ? addresses[t.from] : 'NULL';
        return `(${t.status}, '${t.txid}', ${to}, ${from}, ${t.amount}, ${t.fee}, ${t.nonce}, 2, '${t.timeReceived.toISOString()}', ${t.blockIndex}, NOW(), NOW())`;
    });
    if (transactionClauses.length == 0)
        return Promise.resolve();
    const sql = header + transactionClauses.join(',\n') + ' ON CONFLICT DO NOTHING;';
    return ground.querySingle(sql);
}
exports.saveSingleTransactions = saveSingleTransactions;
function deleteFullBlocks(ground, indexes) {
    return __awaiter(this, void 0, void 0, function* () {
        if (indexes.length === 0) {
            return;
        }
        const header = 'DELETE FROM blocks WHERE index IN ';
        const sql = header + '(' + indexes.join(', ') + ');';
        yield ground.querySingle(sql);
    });
}
exports.deleteFullBlocks = deleteFullBlocks;
//# sourceMappingURL=database-functions.js.map