export const ERP_REGIONS = ["Pakistan", "UAE", "UK & USA"] as const;
export type ErpRegion = (typeof ERP_REGIONS)[number];

export const ERP_ENVIRONMENTS = ["Production", "Test / UAT"] as const;

export const ERP_INTEGRATION_MODES = ["Read-only C# API", "Read-only SQL Server bridge"] as const;
