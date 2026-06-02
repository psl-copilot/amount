import type { DatabaseManagerInstance, LoggerService, ManagerConfig } from '@tazama-lf/frms-coe-lib';
  import type { Case, RuleConfig, RuleRequest, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import type { SupportedTransactionMessage } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import type { BaseMessage } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export type RuleExecutorConfig = Required<Pick<ManagerConfig, 'rawHistory' | 'eventHistory' | 'configuration' | 'localCacheConfig'>>;

export async function handleTransaction(
  req: RuleRequest<SupportedTransactionMessage>,
  determineOutcome: (value: number, ruleConfig: RuleConfig, ruleResult: RuleResult) => RuleResult,
  ruleRes: RuleResult,
  loggerService: LoggerService,
  ruleConfig: RuleConfig,
  databaseManager: DatabaseManagerInstance<RuleExecutorConfig>,
): Promise<RuleResult> {
  const transaction = req.transaction as BaseMessage;
  
  if (!ruleConfig.config.bands) {
    throw new Error('Invalid config provided - bands not provided');
  }
  if (!ruleConfig.config.exitConditions) {
    throw new Error('Invalid config provided - exitConditions not provided');
  }
  if (!ruleConfig.config.parameters || typeof ruleConfig.config.parameters.tolerance != 'number') {
    throw new Error('Invalid config provided - tolerance parameter not provided or invalid type');
  }

const amount = transaction.Payload.amount as unknown as number;

  return determineOutcome(amount, ruleConfig, ruleRes);
  
}