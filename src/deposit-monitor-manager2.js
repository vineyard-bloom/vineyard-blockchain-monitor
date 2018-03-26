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
    constructor(model, currency) {
        this.model = model;
        this.currency = currency;
    }
    getTransactionByTxid(txid) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.model.Transaction.first({ txid: txid, currency: this.currency.id }).exec();
        });
    }
    saveTransaction(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.model.Transaction.create(transaction);
        });
    }
    setTransactionStatus(transaction, status) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.model.Transaction.update(transaction, { status: status });
        });
    }
    listPending(maxBlockIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    SELECT transactions.* FROM transactions
    WHERE status = 0 
    AND transactions.currency = :currency
    AND transactions.index < :maxBlockIndex`;
            return this.model.ground.query(sql, {
                maxBlockIndex: maxBlockIndex,
                currency: this.currency.id
            });
        });
    }
    getLastBlock() {
        return __awaiter(this, void 0, void 0, function* () {
            const last = yield this.model.LastBlock.first({ currency: this.currency.id }).exec();
            if (!last) {
                return;
            }
            return last;
        });
    }
    setLastBlock(block) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentLastBlock = yield this.getLastBlock();
            if (currentLastBlock) {
                return yield this.model.LastBlock.update(currentLastBlock.id, block);
            }
            else {
                return yield this.model.LastBlock.create(block);
            }
        });
    }
}
exports.DepositMonitorManager = DepositMonitorManager;
//# sourceMappingURL=deposit-monitor-manager2.js.map