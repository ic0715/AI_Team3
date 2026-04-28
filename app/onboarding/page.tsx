"use client";

import { useState } from "react";
import Step1BasicInfo from "./Step1BasicInfo";
import Step2Upload from "./Step2Upload";
import Step3Interview from "./Step3Interview";
import Step4Result from "./Step4Result";
import { OnboardingData } from "@/lib/types";

const STEPS = ["기본 정보", "자료 업로드", "음성 인터뷰", "진단 결과"];

const emptyData: OnboardingData = {
  name: "",
  age: "",
  company: "",
  tenure: "",
  emotions: [],
  currentRole: "",
  concerns: "",
  files: [],
  directText: "",
  interviewAnswers: [],
};

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(emptyData);

  const update = (patch: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)]">
      {/* Top nav */}
      <div className="bg-white border-b border-[var(--border)] px-4 pt-safe">
        <div className="flex items-center justify-between h-14">
          <button
            onClick={back}
            disabled={step === 1}
            className="w-8 h-8 flex items-center justify-center disabled:opacity-30"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="#1A1A18" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {step} / {STEPS.length}
          </span>
          <div className="w-8" />
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-[var(--border)] rounded-full mb-3">
          <div
            className="h-1 bg-[var(--accent)] rounded-full transition-all duration-500"
            style={{ width: `${(step / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {step === 1 && <Step1BasicInfo data={data} update={update} onNext={next} />}
        {step === 2 && <Step2Upload data={data} update={update} onNext={next} />}
        {step === 3 && <Step3Interview data={data} update={update} onNext={next} />}
        {step === 4 && <Step4Result data={data} />}
      </div>
    </div>
  );
}
