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
          upperLimit: 1000,
        },
      ],
      parameters: {
        tolerance: 0.1,
        maxQueryRange: 86400000,
      },
      exitConditions: [],
    },
    tenantId: 'DEFAULT',
  };
};

const getMockRequest = (): RuleRequest => {
  const quote = {
    transaction: JSON.parse(
      `{"TxTp":"cases","MsgId":"msg00104","Payload":{"cnic":"1234-5678-910","date":"10-10-2025","msgid":"msg00104","amount":100,"country":"PK","currency":"PKR"},"TenantId":"DEFAULT"}`,
    ),
    networkMap: JSON.parse(
      '{"cfg":"1.0.0","name":"Public Network Map","active":true,"messages":[{"id":"004@1.0.0","cfg":"1.0.0","txTp":"pacs.002.001.12","typologies":[{"id":"typology-processor@1.0.0","cfg":"999@1.0.0","rules":[{"id":"EFRuP@1.0.0","cfg":"none"},{"id":"901@1.0.0","cfg":"1.0.0"},{"id":"902@1.0.0","cfg":"1.0.0"}],"tenantId":"DEFAULT"}]},{"id":"005@1.0.0","cfg":"1.0.0","txTp":"cases","typologies":[{"id":"non-pacs-typology-processor@1.0.0","cfg":"nptp@1.0.0","rules":[{"id":"EFRuP@1.0.0","cfg":"none"},{"id":"amount@1.0.0","cfg":"1.0.0"},{"id":"country-case@1.0.0","cfg":"1.0.0"},{"id":"cnic@1.0.0","cfg":"1.0.0"}],"tenantId":"DEFAULT"}]}],"tenantId":"DEFAULT"}',
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
    describe('Rule-021 bands Testing', () => {
let dataCache: DataCache;
        let req: RuleRequest;
        const amounts = [1000.0, 899.99, 900.0, 900.01, 1099.99, 1100.0, 1100.01];
beforeEach(() => {
        dataCache = {
            dbtrId: 'dbtr_516c7065d75b4fcea6fffb52a9539357',
            cdtrId: 'cdtr_b086a1e193794192b32c8af8550d721d',
            dbtrAcctId: 'dbtrAcct_1fd08e408c184dd28cbaeef03bff1af5',
            cdtrAcctId: 'cdtrAcct_d531e1ba4ed84a248fe26617e79fcb64',
        };
        req = getMockRequest();
      });
test(".01 result with reason of 'The creditor has received an insignificant number of transactions with the same amount in the last 24 hour", async () => {
        const dbData = [2000, 1000, 3000];
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [
            ...dbData.map((x) => ({
              Amt: x,
            })),
          ],
        });
        const res = await handleTransaction(req, determineOutcome, ruleResult, loggerService, getRuleConfig(), databaseManager);
        expect(res).toEqual(
          JSON.parse(
            '{"id":"021@1.0.0", "tenantId": "DEFAULT","cfg":"1.0.0","subRuleRef":".01","reason":"The creditor has received an insignificant number of transactions with the same amount in the last 24 hours"}',
          ),
        );
      });
test(".02 result with reason of 'The creditor has received a significant number of transactions with the same amount in the last 24 hours'", async () => {
        const dbData = [2000, 2022, 50000];
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [
            ...dbData.map((x) => ({
              Amt: x,
            })),
          ],
        });
        const res = await handleTransaction(req, determineOutcome, ruleResult, loggerService, getRuleConfig(), databaseManager);
        expect(res).toEqual(
          JSON.parse(
            '{"id":"021@1.0.0","tenantId": "DEFAULT", "cfg":"1.0.0","subRuleRef":".02","reason":"The creditor has received a significant number of transactions with the same amount in the last 24 hours"}',
          ),
        );
      });
test('.02 result omitted maxQueryRange parameter', async () => {
        const dbData = [2000, 2022, 50000];
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [
            ...dbData.map((x) => ({
              Amt: x,
            })),
          ],
        });
        const rConfig = getRuleConfig();
        rConfig.config.parameters!.maxQueryRange = undefined;
        const res = await handleTransaction(req, determineOutcome, ruleResult, loggerService, rConfig, databaseManager);
        expect(res).toEqual(
          JSON.parse(
            '{"id":"021@1.0.0", "tenantId": "DEFAULT","cfg":"1.0.0","subRuleRef":".02","reason":"The creditor has received a significant number of transactions with the same amount in the last 24 hours"}',
          ),
        );
      });
    });
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
test(".x00 Rule return -> 'Unsuccessful transaction'", async () => {
        databaseManager._eventHistory.query.mockResolvedValue({ rows: [] });
        const req = getMockRequestUnsuccessful();
        const res = await handleTransaction(req, determineOutcome, ruleResult, loggerService, getRuleConfig(), databaseManager);
        expect(res).toEqual(
          JSON.parse('{"id":"021@1.0.0", "cfg":"1.0.0","subRuleRef":".x00","reason":"Unsuccessful transaction", "tenantId": "DEFAULT"}'),
        );
      });
test(".x01 Rule return -> 'Insufficient transaction history'", async () => {
        const dbData = [1];
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [
            ...dbData.map((x) => ({
              Amt: x,
            })),
          ],
        });
        const res = await handleTransaction(req, determineOutcome, ruleResult, loggerService, getRuleConfig(), databaseManager);
        expect(res).toEqual(
          JSON.parse(
            '{"id":"021@1.0.0","tenantId": "DEFAULT", "cfg":"1.0.0","subRuleRef":".x01","reason":"Insufficient transaction history"}',
          ),
        );
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
test('array isnt numbers', async () => {
        const dbData = ['baz', 'bar', 'foo'];
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [
            ...dbData.map((x) => ({
              Amt: x,
            })),
          ],
        });
        try {
          await handleTransaction(req, determineOutcome, ruleResult, loggerService, getRuleConfig(), databaseManager);
        } catch (error) {
          expect((error as Error).message).toBe('Data error: query result type mismatch - expected [numbers]');
        }
      });
test("error return -> 'Empty result from query response'", async () => {
        databaseManager._eventHistory.query.mockResolvedValue({ rows: [] });
        try {
          await handleTransaction(req, determineOutcome, ruleResult, loggerService, getRuleConfig(), databaseManager);
        } catch (error) {
          expect((error as Error).message).toBe('Data error: irretrievable transaction history');
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
test('No exit conditions - bad or missing subRuleRef for ".x00"', async () => {
        databaseManager._eventHistory.query.mockResolvedValue({ rows: [] });
        try {
          const rConfig = getRuleConfig();
          const newReq = getMockRequest();
          newReq.transaction.FIToFIPmtSts.TxInfAndSts.TxSts = '.x00';
          rConfig.config.exitConditions![0].subRuleRef = '';
          rConfig.config.parameters!.maxQueryLimit = 2;
          rConfig.config.parameters!.tolerance = 0.1;
          const res = await handleTransaction(newReq, determineOutcome, ruleResult, loggerService, rConfig, databaseManager);
          expect(res).toEqual(
          JSON.parse(
            '{"id":"021@1.0.0", "tenantId": "DEFAULT","cfg":"1.0.0","desc":"No description provided in rule config.","subRuleRef":".x00","reason":"Incoming transaction is unsuccessful"}',
          ),
        );
        } catch (error) {
          expect((error as Error).message).toBe('Unsuccessful transaction and no exit condition in config');
        }
      });
test('No exit conditions - bad or missing subRuleRef for ".x01"', async () => {
        const dbData = [50];
        databaseManager._eventHistory.query.mockResolvedValue({
          rows: [
            ...dbData.map((x) => ({
              Amt: x,
            })),
          ],
        });
        try {
          const rConfig = getRuleConfig();
          const newReq = getMockRequest();
          rConfig.config.exitConditions![1].subRuleRef = '';
          const res = await handleTransaction(newReq, determineOutcome, ruleResult, loggerService, rConfig, databaseManager);
          expect(res).toEqual(
          JSON.parse(
            '{"id":"021@1.0.0","tenantId": "DEFAULT", "cfg":"1.0.0","desc":"No description provided in rule config.","subRuleRef":".x00","reason":"Incoming transaction is unsuccessful"}',
          ),
        );
        } catch (error) {
          expect((error as Error).message).toBe('Insufficient History and no exit condition in config');
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