/* eslint-disable @typescript-eslint/no-unused-vars */
import { type DataCache, type RuleConfig, type RuleRequest, type RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import {
  DatabaseManagerMock,
  determineOutcome,
  LoggerServiceMock,
  MockDatabaseManagerFactory,
  MockLoggerServiceFactory,
} from '@tazama-lf/frms-coe-lib/lib/tests/mocks';
import { handleTransaction, RuleExecutorConfig } from '../../src/rule';

const getRuleConfig = (): RuleConfig => {
  return {
    id: 'amount@1.0.0',
    cfg: '1.0.0',
    desc: 'amount transactions',
    config: {
      bands: [
        {
          reason: 'transaction amount is big',
          lowerLimit: 1000,
          subRuleRef: '.01',
        },
        {
          reason: 'transaction amount is small',
          subRuleRef: '.02',
          upperLimit: 999,
        },
      ],
      parameters: {
        tolerance: 0.1,
        maxQueryRange: 86400000,
      },
      exitConditions: [],
    },
    creDtTm: '2026-05-04T11:40:00Z',
    updDtTm: '2026-05-04T11:40:00Z',
    tenantId: 'DEFAULT',
  };
};

const getMockRequest = (): RuleRequest => {
  const quote = {
    transaction: JSON.parse(
      `{"TxTp":"cases","MsgId":"msgtest123","Payload":{"cnic":"1234567891011","date":"10-10-2025","msgid":"msgtest123","amount":100000,"country":"US","currency":"USD"},"TenantId":"DEFAULT"}`,
    ),
    networkMap: JSON.parse(
      '{"cfg":"1.0.0","name":"Public Network Map","active":true,"creDtTm":"2026-04-08T00:00:00.000Z","updDtTm":"2026-04-08T00:00:00.000Z","messages":[{"id":"004@1.0.0","cfg":"1.0.0","txTp":"pacs.002.001.12","typologies":[{"id":"typology-processor@1.0.0","cfg":"999@1.0.0","rules":[{"id":"EFRuP@1.0.0","cfg":"none"},{"id":"901@1.0.0","cfg":"1.0.0"},{"id":"902@1.0.0","cfg":"1.0.0"}],"tenantId":"DEFAULT"}]},{"id":"005@1.0.0","cfg":"1.0.0","txTp":"cases","typologies":[{"id":"non-pacs-typology-processor@1.0.0","cfg":"nptp@1.0.0","rules":[{"id":"EFRuP@1.0.0","cfg":"none"},{"id":"amount@1.0.0","cfg":"1.0.0"},{"id":"cnic@1.0.0","cfg":"1.0.0"},{"id":"country-case@1.0.0","cfg":"1.0.0"}],"tenantId":"DEFAULT"}]},{"id":"006@1.0.0","cfg":"1.0.0","txTp":"bhai","typologies":[{"id":"bhai-typology-processor@1.0.0","cfg":"bhai@1.0.0","rules":[{"id":"EFRuP@1.0.0","cfg":"none"},{"id":"fable-amount@1.0.0","cfg":"1.0.0"}],"tenantId":"DEFAULT"}]},{"id":"007@1.0.0","cfg":"1.0.0","txTp":"personality","typologies":[{"id":"personality-typology-processor@1.0.0","cfg":"pa@1.0.0","rules":[{"id":"EFRuP@1.0.0","cfg":"none"},{"id":"DEFAULT-Age@1.0.0","cfg":"1.0.0"}],"tenantId":"DEFAULT"}]},{"id":"0040@1.0.0","cfg":"1.0.0","txTp":"test6","typologies":[{"id":"typology-processor@10.0.0","cfg":"1.0.0","rules":[{"id":"EFRuP@1.0.0","cfg":"none"}],"tenantId":"DEFAULT"}]}],"tenantId":"DEFAULT"}',
    ),
    DataCache: JSON.parse(
      '{}',
    ),
  };
  return quote;
};

const getMockRequestUnsuccessful = (): RuleRequest => {
  const quote = getMockRequest();
  quote.transaction.FIToFIPmtSts.TxInfAndSts.TxSts = 'RJCT';
  return quote;
};

const ruleResult: RuleResult = {
  id: '021@1.0.0',
  cfg: '1.0.0',
  tenantId: 'DEFAULT',
  subRuleRef: '.err',
  reason: 'Unhandled rule result outcome',
};


const dataCache: DataCache = {
  dbtrId: 'dbtr_516c7065d75b4fcea6fffb52a9539357',
  cdtrId: 'cdtr_b086a1e193794192b32c8af8550d721d',
  dbtrAcctId: 'dbtrAcct_1fd08e408c184dd28cbaeef03bff1af5',
  cdtrAcctId: 'cdtrAcct_d531e1ba4ed84a248fe26617e79fcb64',
};

let databaseManager: DatabaseManagerMock<RuleExecutorConfig>;

let loggerService: LoggerServiceMock;
describe('Rule 021 Test', () => {
beforeEach(() => {
        loggerService = MockLoggerServiceFactory();
        loggerService.resetMock();
        databaseManager = MockDatabaseManagerFactory<RuleExecutorConfig>();
        databaseManager.resetMock();
  });
  describe('handleTransaction', () => {
    describe('Exit Conditions', () => {
let dataCache: DataCache;
        let req: RuleRequest;
beforeEach(() => {
        dataCache = {
            dbtrId: 'dbtr_516c7065d75b4fcea6fffb52a9539357',
            cdtrId: 'cdtr_b086a1e193794192b32c8af8550d721d',
            dbtrAcctId: 'dbtrAcct_1fd08e408c184dd28cbaeef03bff1af5',
            cdtrAcctId: 'cdtrAcct_d531e1ba4ed84a248fe26617e79fcb64',
        };
        req = getMockRequest();
      });
test('No RuleConfig - bands', async () => {
        const dbData = [1];
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [
            ...dbData.map((x) => ({
              Amt: x,
            })),
          ],
        });
        const rConfig = getRuleConfig();
        rConfig.config.bands = undefined;
        try {
          await handleTransaction(req, determineOutcome, ruleResult, loggerService, rConfig, databaseManager);
        } catch (error) {
          expect((error as Error).message).toBe('Invalid config provided - bands not provided');
        }
      });
test('No exit conditions', async () => {
        const dbData = [1, 2, 3];
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [
            ...dbData.map((x) => ({
              Amt: x,
            })),
          ],
        });
        try {
          const rConfig = getRuleConfig();
          rConfig.config.exitConditions = undefined;
          await handleTransaction(req, determineOutcome, ruleResult, loggerService, rConfig, databaseManager);
        } catch (error) {
          expect((error as Error).message).toBe('Invalid config provided - exitConditions not provided');
        }
      });
test('No tolerance', async () => {
        // Mocking the request of getting oldes transation timestamp
        const dbData = [1, 2, 3];
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [
            ...dbData.map((x) => ({
              Amt: x,
            })),
          ],
        });
        try {
          const rConfig = getRuleConfig();
          rConfig.config.parameters!.tolerance = undefined;
          await handleTransaction(req, determineOutcome, ruleResult, loggerService, rConfig, databaseManager);
        } catch (error) {
          expect((error as Error).message).toBe('Invalid config provided - tolerance parameter not provided or invalid type');
        }
      });
test('No tolerance - not number', async () => {
        const dbData = [1, 2, 3];
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [
            ...dbData.map((x) => ({
              Amt: x,
            })),
          ],
        });
        try {
          const rConfig = getRuleConfig();
          rConfig.config.parameters!.tolerance = 'zero point two';
          await handleTransaction(req, determineOutcome, ruleResult, loggerService, rConfig, databaseManager);
        } catch (error) {
          expect((error as Error).message).toBe('Invalid config provided - tolerance parameter not provided or invalid type');
        }
      });
    });
  });
});