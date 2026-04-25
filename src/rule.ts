import type { DatabaseManagerInstance, LoggerService, ManagerConfig } from '@tazama-lf/frms-coe-lib';
import type { Case, RuleConfig, RuleRequest, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import type { BaseMessage } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export type RuleExecutorConfig = Required<Pick<ManagerConfig, 'rawHistory' | 'eventHistory' | 'configuration' | 'localCacheConfig'>>;

export async function handleTransaction(
  req: RuleRequest<BaseMessage>,
  determineOutcome: (value: number, ruleConfig: RuleConfig, ruleResult: RuleResult) => RuleResult,
  ruleRes: RuleResult,
  loggerService: LoggerService,
  ruleConfig: RuleConfig,
  databaseManager: DatabaseManagerInstance<RuleExecutorConfig>,
): Promise<RuleResult> {
  
  if (!ruleConfig.config.bands) {
    throw new Error('Invalid config provided - bands not provided');
  }
  if (!ruleConfig.config.exitConditions) {
    throw new Error('Invalid config provided - exitConditions not provided');
  }
  if (!ruleConfig.config.parameters || typeof ruleConfig.config.parameters.tolerance != 'number') {
    throw new Error('Invalid config provided - tolerance parameter not provided or invalid type');
  }
  // Loop: find over ruleConfig.config.exitConditions
  const InsufficientHistory = ruleConfig.config.exitConditions.find((b: { reason: string; subRuleRef: string }) => b.subRuleRef === '.x01');
  // Loop: find over ruleConfig.config.exitConditions
  const UnsuccessfulTransaction = ruleConfig.config.exitConditions.find(( b: { reason: string; subRuleRef: string }) => b.subRuleRef === '.x00');
  if (req.transaction.FIToFIPmtSts.TxInfAndSts.TxSts !== 'ACCC') {
    if (UnsuccessfulTransaction === undefined) {
      throw new Error('Unsuccessful transaction and no exit condition in config');
    }
    return { ...ruleRes, reason: UnsuccessfulTransaction.reason, subRuleRef: UnsuccessfulTransaction.subRuleRef};
  }

  const currentPacs002TimeFrame = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;

  const creditorAccount = req.DataCache.cdtrAcctId;

  const maxQueryRange = ruleConfig.config.parameters.maxQueryRange ? ruleConfig.config.parameters.maxQueryRange : undefined;

  const tenantId = req.transaction.TenantId;

  // Define parameterized query
  const getAmtNewestPacs008 = `WITH all_success AS (
      SELECT
        DISTINCT EndToEndId
      FROM
        transaction
      WHERE
        source = $1
        AND TxTp = 'pacs.002.001.12'
        AND TxSts = 'ACCC'
        AND CreDtTm::timestamptz <= $2::timestamptz
        AND TenantId = $3
        AND (
          $4::bigint IS NULL
          OR CreDtTm::timestamptz >= $2::timestamptz - ($4::bigint * interval '1 millisecond')
        )
    )
    SELECT
      t.Amt AS "Amt"
    FROM
      transaction t
      JOIN all_success s USING (EndToEndId)
    WHERE
      t.TxTp = 'pacs.008.001.10'
      AND t.TenantId = $3
    ORDER BY
      t.CreDtTm::timestamptz DESC;`;

  // Execute query with parameters
  const queryResult = await databaseManager._eventHistory.query<{ [key: string]: unknown }>(getAmtNewestPacs008, [
    creditorAccount,
    currentPacs002TimeFrame,
    tenantId,
    maxQueryRange
  ]);
  if (!queryResult.rows.length) {
    throw new Error('Data error: irretrievable transaction history');
  }
  // Loop: map over queryResult.rows
  const amounts = queryResult.rows.map((r) => {
    return Number(r.Amt);
  });
  if (amounts.some((amt) => isNaN(amt))) {
    throw new Error('Data error: query result type mismatch - expected [numbers]');
  }
  if (amounts.length <= 1) {
    if (InsufficientHistory === undefined) {
      throw new Error('Insufficient History and no exit condition in config');
    }
    return {...ruleRes, subRuleRef: InsufficientHistory.subRuleRef, reason: InsufficientHistory.reason };
  }

  const tolerance = amounts[0] * ruleConfig.config.parameters.tolerance;
  // Loop: reduce over amounts
  const countOfMatchingAmounts = amounts.reduce((acc, val) => {
    if (Math.abs(val - amounts[0]) <= tolerance) {
      return acc + 1;
    }
    return acc;
  }, 0);

  return determineOutcome(countOfMatchingAmounts, ruleConfig, ruleRes);
  
}