"use client";

import { useState } from "react";
import { QuoteScreen } from "./QuoteScreen";
import { YesterdayTargetReview } from "./YesterdayTargetReview";
import { TargetAcceptance } from "./TargetAcceptance";
import { MindStateCheckIn } from "./MindStateCheckIn";
import { RoadToSuccess } from "./RoadToSuccess";
import type { WelcomeData, TargetComparisonRow, TierProgress } from "@/lib/dailyWelcome";

// Implements PRD AE01 (Sign In and Welcome Sequence): welcome -> yesterday/
// target review -> target acceptance -> MindState check-in -> tier/road to
// success -> mission intro -> mission centre. Acceptance criteria requires
// this to complete in under two minutes for a returning user, so each step
// is intentionally lightweight (single click/tap to advance).
//
// All data is now real, fetched server-side in
// app/(onboarding)/onboarding/page.tsx (previously 100% mock —
// lib/onboardingData.ts's own comment admitted this: "Placeholder data
// only... once live").

const BASE_STEPS = ["welcome", "yesterday", "target", "mindstate", "road", "mission"] as const;
type Step = (typeof BASE_STEPS)[number];

export function OnboardingFlow({
  userName,
  welcomeData,
  targetComparison,
  tierProgress,
  janusInsight,
  leadsGoalCount,
  skipMindState,
}: {
  userName: string;
  welcomeData: WelcomeData;
  targetComparison: TargetComparisonRow[];
  tierProgress: TierProgress;
  janusInsight: string | null;
  leadsGoalCount: number;
  skipMindState: boolean;
}) {
  const steps = skipMindState ? BASE_STEPS.filter((s) => s !== "mindstate") : BASE_STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const step: Step = steps[stepIndex];

  async function next() {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }

    try {
      await fetch("/api/welcome/acknowledge", { method: "POST" });
    } finally {
      // Hard navigation — guarantees the (app) layout fully re-evaluates
      // shouldShowWelcome against fresh data rather than risking a
      // cached client-side render of this same sequence being reused.
      window.location.href = "/command";
    }
  }

  return (
    <div className="h-screen w-full bg-base-950">
      <div className="h-1 w-full bg-base-800">
        <div
          className="h-1 bg-status-active transition-all"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      <div className="h-[calc(100%-4px)]">
        {step === "welcome" && (
          <QuoteScreen
            eyebrow="Everyone has the will to win, but very few have the will to prepare to win…"
            headline={`Welcome back, ${userName}. Let's get this day started.`}
            onContinue={next}
          />
        )}
        {step === "yesterday" && (
          <YesterdayTargetReview data={welcomeData} janusInsight={janusInsight} onContinue={next} />
        )}
        {step === "target" && (
          <TargetAcceptance userName={userName} rows={targetComparison} onAccept={next} />
        )}
        {step === "mindstate" && <MindStateCheckIn onContinue={next} />}
        {step === "road" && <RoadToSuccess tierProgress={tierProgress} onContinue={next} />}
        {step === "mission" && (
          <QuoteScreen
            eyebrow="Winners focus on winning, losers focus on winners…"
            headline={`Our goal is to action ${leadsGoalCount} lead${leadsGoalCount === 1 ? "" : "s"} today.`}
            onContinue={next}
          />
        )}
      </div>
    </div>
  );
}
