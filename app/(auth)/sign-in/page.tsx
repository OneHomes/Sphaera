import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignInForm } from "@/components/auth/SignInForm";
import { AmbientPanel } from "@/components/auth/AmbientPanel";

export const dynamic = "force-dynamic";

// Only same-site paths are honoured, so a crafted ?callbackUrl= can't redirect off-site.
function safeCallback(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

export default async function SignInPage({ searchParams }: { searchParams: { callbackUrl?: string | string[] } }) {
  // Already signed in (valid session cookie): skip the sign-in screen.
  const session = await getServerSession(authOptions);
  if (session) redirect(safeCallback(searchParams.callbackUrl));

  return (
    <div className="flex min-h-screen w-full bg-base-950">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
      <AmbientPanel />
    </div>
  );
}
