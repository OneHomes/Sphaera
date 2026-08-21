"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuoteScreen } from "./QuoteScreen";
import { YesterdayTargetReview } from "./YesterdayTargetReview";
import { TargetAcceptance } from "./TargetAcceptance";
import { MindStateCheckIn } from "./MindStateCheckIn";
import { RoadToSuccess } from "./RoadToSuccess";
import { welcomeQuote, missionQuote } from "@/lib/onboardingData";

// Implements PRD AE01 (Sign In and Welcome Sequence): welcome -> yesterday/
// target review -> target acceptance -> MindState check-in -> tier/road to
// success -> mission intro -> mission centre. Acceptance criteria requires
// this to complete in under two minutes for a returning user, so each step
// is intentionally lightweight (single click/tap to advance).

const STEP_COUNT = 6;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  function next() {
    if (step < STEP_COUNT - 1) {
      setStep((s) => s + 1);
    } else {
      router.push("/command");
    }
  }

  return (
    <div className="h-screen w-full bg-base-950">
      <div className="h-1 w-full bg-base-800">
        <div
          className="h-1 bg-status-active transition-all"
          style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }}
        />
      </div>

      <div className="h-[calc(100%-4px)]">
        {step === 0 && (
          <QuoteScreen
            eyebrow={welcomeQuote.eyebrow}
            headline={welcomeQuote.headline}
            onContinue={next}
          />
        )}
        {step === 1 && <YesterdayTargetReview onContinue={next} />}
        {step === 2 && <TargetAcceptance onAccept={next} />}
        {step === 3 && <MindStateCheckIn onContinue={next} />}
        {step === 4 && <RoadToSuccess onContinue={next} />}
        {step === 5 && (
          <QuoteScreen
            eyebrow={missionQuote.eyebrow}
            headline={missionQuote.headline}
            onContinue={next}
          />
        )}
      </div>
    </div>
  );
}
