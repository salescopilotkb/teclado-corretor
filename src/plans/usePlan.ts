import { useEffect, useState } from 'react';
import { getPlan, onPlanChange } from './plan';
import type { PlanInfo } from './plan';

/** O plano da conta, redesenhando a tela quando ele muda (compra, vencimento). */
export function usePlan(): PlanInfo {
  const [plan, setPlan] = useState<PlanInfo>(getPlan);
  useEffect(() => onPlanChange(setPlan), []);
  return plan;
}
