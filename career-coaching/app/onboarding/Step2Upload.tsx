"use client";

import { useRef, useState } from "react";
import { OnboardingData } from "@/lib/types";

interface Props {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  onNext: () => void;
}

export default function Step2Upload({ data, update, onNext }: Props) {
  const [useText, setUseText] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);

  const addFiles = async (newFiles: FileList | null) => {
    if (!newFiles) return;
    setLoading(true);

    const readFile = (file: File): Promise<{ name: string; size: number; content: string; mimeType: string }> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        const isPDF = file.type === "application/pdf";

        reader.onload = () => {
          let content: string;
          if (isPDF) {
            const buffer = reader.result as ArrayBuffer;
            const bytes = new Uint8Array(buffer);
            let binary = "";
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            content = btoa(binary);
          } else {
            content = reader.result as string;
          }
          resolve({ name: file.name, size: file.size, content, mimeType: isPDF ? "application/pdf" : "text/plain" });
        };

        reader.onerror = () => reject(reader.error);
        isPDF ? reader.readAsArrayBuffer(file) : reader.readAsText(file);
      });

    try {
      const added = await Promise.all(Array.from(newFiles).map(readFile));
      update({ files: [...data.files, ...added] });
    } finally {
      setLoading(false);
    }
  };

  const removeFile = (index: number) => {
    update({ files: data.files.filter((_, i) => i !== index) });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const canProceed = data.files.length > 0 || data.directText.trim().length > 0;

  return (
    <div className="px-5 py-6 space-y-6 fade-up">
      <div>
        <h1 className="text-xl font-700 text-[var(--text-primary)]">자료 업로드</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          이력서, 강점 진단 결과 등을 업로드하면 더 정확한 진단이 가능합니다.
        </p>
      </div>

      {/* Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setUseText(false)}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
            !useText
              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
              : "bg-white border-[var(--border)] text-[var(--text-secondary)]"
          }`}
        >
          파일 업로드
        </button>
        <button
          onClick={() => setUseText(true)}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
            useText
              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
              : "bg-white border-[var(--border)] text-[var(--text-secondary)]"
          }`}
        >
          직접 입력
        </button>
      </div>

      {!useText ? (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragging
                ? "border-[var(--accent)] bg-[var(--accent-light)]"
                : "border-[var(--border)] bg-white hover:border-[var(--accent)] hover:bg-[var(--accent-light)]"
            }`}
          >
            <div className="text-3xl mb-3">📄</div>
            <p className="text-sm font-medium text-[var(--text-primary)]">파일을 여기에 드래그하거나 탭하세요</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">PDF, 텍스트 파일 지원</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.txt"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* File chips */}
          {data.files.length > 0 && (
            <div className="space-y-2">
              {data.files.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📎</span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px]">{f.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{formatSize(f.size)}</p>
                    </div>
                  </div>
                  <button onClick={() => removeFile(i)} className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--error)]">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          <div className="bg-[var(--accent-light)] rounded-xl p-4">
            <p className="text-xs font-medium text-[var(--accent)] mb-2">추천 자료</p>
            <ul className="space-y-1">
              {["이력서 / 경력기술서", "강점 진단 결과 (갤럽, MBTI 등)", "성과 평가 결과", "개인 노트 / 업무 일지"].map((s) => (
                <li key={s} className="text-xs text-[var(--text-secondary)] flex gap-2">
                  <span className="text-[var(--accent)]">•</span> {s}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <textarea
            value={data.directText}
            onChange={(e) => update({ directText: e.target.value })}
            placeholder="이력 요약, 강점, 업무 경험 등을 자유롭게 입력하세요..."
            rows={10}
            className="w-full px-3 py-3 rounded-xl border border-[var(--border)] bg-white text-sm resize-none transition-all"
          />
          <div className="text-right text-xs text-[var(--text-muted)]">{data.directText.length}자</div>
        </div>
      )}

      {/* Skip option */}
      <p className="text-center text-xs text-[var(--text-muted)]">
        자료가 없어도 진행할 수 있습니다.
      </p>

      <button
        onClick={onNext}
        disabled={loading}
        className="w-full h-12 rounded-xl bg-[var(--accent)] text-white font-600 text-base transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? "파일 읽는 중..." : canProceed ? "다음" : "건너뛰기"}
      </button>

      <div className="pb-8" />
    </div>
  );
}
