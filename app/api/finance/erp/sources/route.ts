import { NextResponse } from "next/server";
import { listErpSources, saveErpSource } from "@/lib/finance/erpRegistryData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Registered ERP source list/registration — normal user-facing Finance
// admin screen, direct port of the source app's source-registry CRUD.
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const sources = await listErpSources();
      return NextResponse.json(sources);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await saveErpSource({
        id: body.id ? String(body.id) : undefined,
        name: String(body.name ?? ""),
        region: String(body.region ?? ""),
        legalEntity: body.legalEntity !== undefined ? String(body.legalEntity) : undefined,
        environment: body.environment !== undefined ? String(body.environment) : undefined,
        integrationMode: body.integrationMode !== undefined ? String(body.integrationMode) : undefined,
        endpointUrl: body.endpointUrl !== undefined ? String(body.endpointUrl) : undefined,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: body.id ? "finance_erp_source_updated" : "finance_erp_source_created",
        targetId: result.id,
        details: `${body.id ? "Updated" : "Registered"} ERP source "${body.name}" (${body.region})`,
      });
      return NextResponse.json(result, { status: body.id ? 200 : 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
