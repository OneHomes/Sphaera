"use client";

import type { ComponentProps } from "react";
import { WithFinanceState } from "./FinanceDataContext";
import { OverviewPage } from "./OverviewPage";
import { BudgetVsActualPage } from "./BudgetVsActualPage";
import { SpendingExplorerPage } from "./SpendingExplorerPage";
import { HistoricalDebtPage } from "./HistoricalDebtPage";
import { NeedsAllocationPage } from "./NeedsAllocationPage";
import { AllPaymentsPage } from "./AllPaymentsPage";
import { OverheadAnalysisPage } from "./OverheadAnalysisPage";
import { DisputedChargesPage } from "./DisputedChargesPage";
import { CostHeadsPage } from "./CostHeadsPage";
import { OrganiseCostsPage } from "./OrganiseCostsPage";
import { FinancialPlanningPage } from "./FinancialPlanningPage";
import { PaymentTraceabilityPage } from "./PaymentTraceabilityPage";
import { PeopleCostsPage } from "./PeopleCostsPage";
import { DataBackupsPage } from "./DataBackupsPage";

// Client wrappers for the Finance screens: the server page passes only its own small data, and
// the shared ledger comes from FinanceDataProvider (loaded once per visit, see that file).
// Each screen component is unchanged.

type Without<T, K extends keyof T> = Omit<T, K>;

export function OverviewView(props: Without<ComponentProps<typeof OverviewPage>, "state">) {
  return <WithFinanceState>{(state) => <OverviewPage state={state} {...props} />}</WithFinanceState>;
}

export function BudgetView() {
  return <WithFinanceState>{(state) => <BudgetVsActualPage state={state} />}</WithFinanceState>;
}

export function ExplorerView() {
  return <WithFinanceState>{(state) => <SpendingExplorerPage state={state} />}</WithFinanceState>;
}

export function HistoricalDebtView() {
  return <WithFinanceState>{(state) => <HistoricalDebtPage state={state} />}</WithFinanceState>;
}

export function CostHeadsView() {
  return <WithFinanceState>{(state) => <CostHeadsPage state={state} />}</WithFinanceState>;
}

export function OrganiseView() {
  return <WithFinanceState>{(state) => <OrganiseCostsPage state={state} />}</WithFinanceState>;
}

export function NeedsAllocationView() {
  return (
    <WithFinanceState>
      {(state) => (
        <NeedsAllocationPage
          transactions={state.transactions}
          departments={state.departments}
          managementCostHeads={state.managementCostHeads}
          costHeads={state.costHeads}
        />
      )}
    </WithFinanceState>
  );
}

export function PaymentsView(
  props: Without<ComponentProps<typeof AllPaymentsPage>, "transactions" | "departments" | "managementCostHeads" | "costHeads">
) {
  return (
    <WithFinanceState>
      {(state) => (
        <AllPaymentsPage
          transactions={state.transactions}
          departments={state.departments}
          managementCostHeads={state.managementCostHeads}
          costHeads={state.costHeads}
          {...props}
        />
      )}
    </WithFinanceState>
  );
}

export function OverheadsView(props: Without<ComponentProps<typeof OverheadAnalysisPage>, "costHeads" | "departments" | "transactions">) {
  return (
    <WithFinanceState>
      {(state) => (
        <OverheadAnalysisPage costHeads={state.managementCostHeads} departments={state.departments} transactions={state.transactions} {...props} />
      )}
    </WithFinanceState>
  );
}

export function DisputesView() {
  return (
    <WithFinanceState>{(state) => <DisputedChargesPage transactions={state.transactions.filter((t) => t.dispute !== null)} />}</WithFinanceState>
  );
}

export function PlanningView(props: Without<ComponentProps<typeof FinancialPlanningPage>, "departments" | "costHeads" | "transactions">) {
  return (
    <WithFinanceState>
      {(state) => (
        <FinancialPlanningPage departments={state.departments} costHeads={state.managementCostHeads} transactions={state.transactions} {...props} />
      )}
    </WithFinanceState>
  );
}

export function TraceabilityView(props: Without<ComponentProps<typeof PaymentTraceabilityPage>, "transactions" | "departments" | "costHeads">) {
  return (
    <WithFinanceState>
      {(state) => (
        <PaymentTraceabilityPage transactions={state.transactions} departments={state.departments} costHeads={state.managementCostHeads} {...props} />
      )}
    </WithFinanceState>
  );
}

export function PeopleView(props: Without<ComponentProps<typeof PeopleCostsPage>, "departments" | "transactions">) {
  return (
    <WithFinanceState>{(state) => <PeopleCostsPage departments={state.departments} transactions={state.transactions} {...props} />}</WithFinanceState>
  );
}

export function BackupsView(props: Without<ComponentProps<typeof DataBackupsPage>, "state">) {
  return <WithFinanceState>{(state) => <DataBackupsPage state={state} {...props} />}</WithFinanceState>;
}
