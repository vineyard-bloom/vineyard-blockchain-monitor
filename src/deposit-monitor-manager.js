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
class DepositMonitorManager {
    constructor(model) {
        this.model = model;
    }
    getTransactionByTxid(txid, currency) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.model.Transaction.first({
                txid: txid,
                currency: currency
            }).exec();
        });
    }
    saveTransaction(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.model.Transaction.create(transaction);
        });
    }
    setStatus(transaction, status) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.model.Transaction.update(transaction, {
                status: status
            });
        });
    }
    listPending(currency, maxBlockIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const transactionsTable = this.model.Transaction.trellis.table.name;
            const sql = `
    SELECT ${transactionsTable}.* FROM ${transactionsTable}
    JOIN blocks ON blocks.id = ${transactionsTable}.block
    AND blocks.index < :maxBlockIndex
    WHERE status = 0 AND ${transactionsTable}.currency = :currency`;
            return yield this.model.ground.query(sql, {
                maxBlockIndex: maxBlockIndex,
                currency: currency
            });
        });
    }
    getLastBlock(currency) {
        return __awaiter(this, void 0, void 0, function* () {
            const last = yield this.model.LastBlock.first({ currency: currency }).exec();
            if (!last)
                return last;
            return yield this.model.Block.first({ id: last.block }).exec();
        });
    }
    setLastBlock(block, currency) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield this.getLastBlock(currency);
            if (exists) {
                const sql = `UPDATE last_blocks SET block = :block WHERE currency = :currency`;
                return yield this.model.ground.query(sql, {
                    block: block,
                    currency: currency,
                });
            }
            else {
                yield this.model.LastBlock.create({ block: block, currency: currency });
            }
        });
    }
    setLastBlockByHash(hash, currency) {
        return __awaiter(this, void 0, void 0, function* () {
            const block = yield this.model.Block.first({ hash: hash }).exec();
            return yield this.model.LastBlock.update({ block: block }, { currency: currency });
        });
    }
    saveBlock(block) {
        return __awaiter(this, void 0, void 0, function* () {
            const filter = block.hash
                ? { currency: block.currency, hash: block.hash }
                : { currency: block.currency, index: block.index };
            const existing = yield this.model.Block.first(filter);
            if (existing)
                return existing;
            return yield this.model.Block.create(block);
        });
    }
    saveLastBlock(block, currency) {
        return __awaiter(this, void 0, void 0, function* () {
            let lastBlock;
            lastBlock.block = block;
            lastBlock.currency = currency;
            return yield this.model.LastBlock.create(lastBlock);
        });
    }
}
exports.DepositMonitorManager = DepositMonitorManager;
//# sourceMappingURL=deposit-monitor-manager.js.map