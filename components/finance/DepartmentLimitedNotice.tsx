import Link from "next/link";

// Shown instead of a company-wide Finance screen to a user whose access is limited to
// specific departments (those screens cannot be filtered by department).
export function DepartmentLimitedNotice() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm rounded-xl border border-base-700 bg-base-900 p-5 text-center">
        <h1 className="text-sm font-medium text-ink-50">Not available with department access</h1>
        <p className="mt-1 text-xs text-ink-500">
          This screen shows company-wide figures. Your Finance access covers selected departments only.
        </p>
        <Link href="/finance" className="mt-3 inline-block text-xs text-status-active hover:underline">
          Go to CEO Overview
        </Link>
      </div>
    </div>
  );
}
