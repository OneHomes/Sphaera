import { peopleTemplate } from "@/lib/finance/peopleImport";
import { payrollRoute, xlsxResponse } from "@/lib/finance/payrollRoute";

// Employee roster template (v41 /api/people/template) with the approved-department dropdown.
export async function GET() {
  return payrollRoute(async () => xlsxResponse(await peopleTemplate(), "Sphaera_People_Import_Template.xlsx"));
}
