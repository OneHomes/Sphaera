import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";
import { AmbientPanel } from "@/components/auth/AmbientPanel";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full bg-base-950">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
      <AmbientPanel />
    </div>
  );
}
