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
const utility_1 = require("../utility");
const index_1 = require("../utility/index");
const database_functions_1 = require("../database-functions");
const monitor_logic_1 = require("../monitor-logic");
const sql_helpers_1 = require("./sql-helpers");
function mapTransactionInputs(transaction) {
    return transaction.inputs.map((input, index) => ({
        txid: transaction.txid,
        index: index,
        input: input
    }));
}
function mapTransactionOutputs(transaction) {
    return transaction.outputs.map((output, index) => ({
        txid: transaction.txid,
        index: index,
        output: output
    }));
}
function saveTransactionInputs(ground, inputs) {
    return __awaiter(this, void 0, void 0, function* () {
        if (inputs.length == 0)
            return Promise.resolve();
        const header = 'INSERT INTO "txins" ("transaction", "index", "sourceTransaction", "sourceIndex", "scriptSigHex", "scriptSigAsm", "sequence", "coinbase", "created", "modified") VALUES\n';
        const transactionClauses = inputs.map(association => sql_helpers_1.CREATE_TX_IN(association));
        const sql = header + transactionClauses.join(',\n') + ' ON CONFLICT DO NOTHING RETURNING "sourceTransaction", "sourceIndex";';
        yield ground.query(sql);
    });
}
function saveTransactionOutputs(ground, outputs, addresses) {
    return __awaiter(this, void 0, void 0, function* () {
        if (outputs.length == 0)
            return Promise.resolve();
        const header = 'INSERT INTO "txouts" ("transaction", "index", "scriptPubKeyHex", "scriptPubKeyAsm", "address", "amount", "created", "modified") VALUES\n';
        const transactionClauses = outputs.map(association => sql_helpers_1.CREATE_TX_OUT(association, addresses[association.output.address]));
        const sql = header + transactionClauses.join(',\n') + ' ON CONFLICT DO NOTHING;';
        yield ground.querySingle(sql);
    });
}
function saveTransactions(ground, transactions) {
    return __awaiter(this, void 0, void 0, function* () {
        if (transactions.length == 0)
            return Promise.resolve();
        const header = 'INSERT INTO "transactions" ("status", "txid", "fee", "nonce", "currency", "timeReceived", "blockIndex", "created", "modified") VALUES\n';
        const transactionClauses = transactions.map(sql_helpers_1.CREATE_TX);
        const sql = header + transactionClauses.join(',\n') + ' ON CONFLICT DO NOTHING;';
        yield ground.querySingle(sql);
    });
}
function gatherAddresses(outputs) {
    return [...new Set(outputs.map(o => o.output.address))];
}
function saveFullBlocks(ground, bundles) {
    return __awaiter(this, void 0, void 0, function* () {
        // Can save to sortedBlocks var and set lasBlockIndex
        const transactions = index_1.flatMap(bundles, b => b.transactions);
        const blocks = bundles.map(b => b.block);
        const inputs = index_1.flatMap(transactions, mapTransactionInputs);
        const outputs = index_1.flatMap(transactions, mapTransactionOutputs);
        const addresses = gatherAddresses(outputs);
        const addressesFromDb = yield database_functions_1.getOrCreateAddresses2(ground, addresses);
        yield database_functions_1.saveBlocks(ground, blocks);
        yield saveTransactions(ground, transactions);
        yield saveTransactionInputs(ground, inputs);
        yield saveTransactionOutputs(ground, outputs, addressesFromDb);
    });
}
function scanBitcoinExplorerBlocks(dao, client, config, profiler = new utility_1.EmptyProfiler()) {
    return __awaiter(this, void 0, void 0, function* () {
        const blockQueue = yield monitor_logic_1.createBlockQueue(dao.lastBlockDao, client, config.queue, config.minConfirmations, 1);
        const saver = (blocks) => saveFullBlocks(dao.ground, blocks);
        return monitor_logic_1.scanBlocks(blockQueue, saver, dao.ground, dao.lastBlockDao, config, profiler);
    });
}
exports.scanBitcoinExplorerBlocks = scanBitcoinExplorerBlocks;
//# sourceMappingURL=bitcoin-explorer.js.map