"use client";

import { useState } from "react";
import { OnboardingData, Emotion, EMOTION_LABELS, TENURE_OPTIONS } from "@/lib/types";

interface Props {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
}

export default function Step1BasicInfo({ data, update, onNext }: Props) {
  const [submitted, setSubmitted] = useState(false);

  const toggleEmotion = (e: Emotion) => {
    const emotions = data.emotions.includes(e)
      ? data.emotions.filter((x) => x !== e)
      : [...data.emotions, e];
    update({ emotions });
  };

  const errors = {
    name: !data.name,
    age: !data.age,
    tenure: !data.tenure,
    currentRole: !data.currentRole,
    concerns: !data.concerns,
  };

  const canProceed = !Object.values(errors).some(Boolean);

  const handleNext = () => {
    setSubmitted(true);
    if (canProceed) onNext();
  };

  const fieldClass = (hasError: boolean) =>
    `w-full h-11 px-3 rounded-xl border bg-white text-sm transition-all ${
      submitted && hasError
        ? "border-[var(--error)] focus:border-[var(--error)]"
        : "border-[var(--border)]"
    }`;

  return (
    <div className="px-5 py-6 space-y-6 fade-up">
      <div>
        <h1 className="text-xl font-700 text-[var(--text-primary)]">기본 정보</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          커리어 진단을 위한 기본 정보를 입력해주세요.
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-primary)]">이름</label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="홍길동"
          className={fieldClass(errors.name)}
        />
        {submitted && errors.name && (
          <p className="text-xs text-[var(--error)]">이름을 입력해주세요.</p>
        )}
      </div>

      {/* Age + Company row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-primary)]">나이</label>
          <input
            type="number"
            value={data.age}
            onChange={(e) => update({ age: e.target.value })}
            placeholder="30"
            className={fieldClass(errors.age)}
          />
          {submitted && errors.age && (
            <p className="text-xs text-[var(--error)]">나이를 입력해주세요.</p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-primary)]">회사명</label>
          <input
            type="text"
            value={data.company}
            onChange={(e) => update({ company: e.target.value })}
            placeholder="회사 이름"
            className="w-full h-11 px-3 rounded-xl border border-[var(--border)] bg-white text-sm transition-all"
          />
        </div>
      </div>

      {/* Tenure */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-primary)]">재직 기간</label>
        <select
          value={data.tenure}
          onChange={(e) => update({ tenure: e.target.value })}
          className={`appearance-none ${fieldClass(errors.tenure)}`}
        >
          <option value="">선택해주세요</option>
          {TENURE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {submitted && errors.tenure && (
          <p className="text-xs text-[var(--error)]">재직 기간을 선택해주세요.</p>
        )}
      </div>

      {/* Current role */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-primary)]">현재 역할</label>
        <input
          type="text"
          value={data.currentRole}
          onChange={(e) => update({ currentRole: e.target.value })}
          placeholder="예: 프로덕트 매니저, 마케터, 개발자..."
          className={fieldClass(errors.currentRole)}
        />
        {submitted && errors.currentRole && (
          <p className="text-xs text-[var(--error)]">현재 역할을 입력해주세요.</p>
        )}
      </div>

      {/* Emotions */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-primary)]">
          현재 감정 상태 <span className="text-[var(--text-muted)] font-normal">(복수 선택)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EMOTION_LABELS) as Emotion[]).map((e) => (
            <button
              key={e}
              onClick={() => toggleEmotion(e)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                data.emotions.includes(e)
                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                  : "bg-white border-[var(--border)] text-[var(--text-secondary)]"
              }`}
            >
              {EMOTION_LABELS[e]}
            </button>
          ))}
        </div>
      </div>

      {/* Concerns */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-primary)]">커리어 고민</label>
        <textarea
          value={data.concerns}
          onChange={(e) => update({ concerns: e.target.value })}
          placeholder="현재 커리어에서 가장 고민되는 점을 자유롭게 적어주세요."
          rows={4}
          className={`w-full px-3 py-3 rounded-xl border bg-white text-sm resize-none transition-all ${
            submitted && errors.concerns ? "border-[var(--error)]" : "border-[var(--border)]"
          }`}
        />
        {submitted && errors.concerns ? (
          <p className="text-xs text-[var(--error)]">커리어 고민을 입력해주세요.</p>
        ) : (
          <div className="text-right text-xs text-[var(--text-muted)]">{data.concerns.length}자</div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={handleNext}
        className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-600 text-base transition-all active:scale-[0.98]"
      >
        다음
      </button>

      <div className="pb-8" />
    </div>
  );
}
