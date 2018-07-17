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
require('source-map-support').install();
const lab_1 = require("../lab");
const config_1 = require("../config/config");
const vineyard_cron_1 = require("vineyard-cron");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const village = yield lab_1.createEthereumVillage(config_1.ethereumConfig);
        console.log('Initialized village');
        let model = village.model;
        yield (model.ground).regenerate();
        console.log('Vineyard Ground model regenerated');
        yield model.Currency.create({ name: 'Bitcoin' });
        yield model.Currency.create({ name: 'Ethereum' });
        yield model.LastBlock.create({ currency: 2 });
        yield lab_1.startEthereumMonitor(village, {
            queue: config_1.ethereumConfig.blockQueue,
            profiling: config_1.ethereumConfig.profiling ? true : false
        });
    });
}
const ethereumCron = new vineyard_cron_1.Cron([
    {
        name: 'Ethereum Scanner',
        action: () => main()
    }
], config_1.ethereumConfig.interval);
ethereumCron.start();
//# sourceMappingURL=eth-scan-dev.js.map