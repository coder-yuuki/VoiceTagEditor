import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileAudio,
  FolderOpen,
  Plus,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type {
  AlbumData,
  ChipColor,
  ExportSettings,
  Track,
  WizardStep,
} from '../types';
import { AlbumInfoForm } from './AlbumInfoForm';
import { StepIndicator, type StepNumber } from './StepIndicator';
import { TrackTable } from './TrackTable';

interface SimpleWizardProps {
  wizardStep: WizardStep;
  tracks: Track[];
  albumData: AlbumData;
  exportSettings: ExportSettings;
  artworkSourceLabel: string;
  isProcessing: boolean;
  isFfmpegReady: boolean;
  savedCount: number;
  getChipColor: (text: string) => ChipColor;
  onStepChange: (step: WizardStep) => void;
  onPickAudioFiles: () => void;
  onPickDirectories: () => void;
  onSelectArtwork: () => void;
  onClearArtwork: () => void;
  onAlbumFieldChange: (field: keyof AlbumData, value: string | boolean | string[]) => void;
  onTagInput: (value: string) => void;
  onTagKeyDown: (event: KeyboardEvent) => void;
  onRemoveTag: (tag: string) => void;
  onTrackDelete: (trackId: string) => void;
  onTrackChange: (trackId: string, field: keyof Track, value: string | boolean | string[]) => void;
  onNumberInput: (value: string) => string;
  onPadNumber: (value: string) => string;
  onArtistInput: (trackId: string, value: string) => void;
  onArtistPaste: (trackId: string, event: ClipboardEvent) => void;
  onArtistKeyDown: (trackId: string, event: KeyboardEvent) => void;
  onCopyArtist: (artist: string) => void;
  onRemoveArtist: (trackId: string, artist: string) => void;
  onCopyAllArtists: (artists: string[]) => void;
  onApplyVoiceActorsToAll: (input: string) => void;
  onCopyVoiceActorsFromPrevious: (trackId: string) => void;
  onCopyFirstTrackVoiceActorsToAll: () => void;
  onSelectOutputFolder: () => void;
  onExport: () => void;
  onStartOver: () => void;
}

const stepDescriptions: Record<StepNumber, string> = {
  1: '編集したい音声ファイル、または作品のフォルダを選んでください。',
  2: '音声作品名・サークル名・発売日・タグなど、作品全体の情報を入力します。分かるところだけで大丈夫です。',
  3: '各トラックのタイトルや番号を確認・修正してください。',
  4: '保存先を選んで、編集した音声を保存します。',
};

export function SimpleWizard({
  wizardStep,
  tracks,
  albumData,
  exportSettings,
  artworkSourceLabel,
  isProcessing,
  isFfmpegReady,
  savedCount,
  getChipColor,
  onStepChange,
  onPickAudioFiles,
  onPickDirectories,
  onSelectArtwork,
  onClearArtwork,
  onAlbumFieldChange,
  onTagInput,
  onTagKeyDown,
  onRemoveTag,
  onTrackDelete,
  onTrackChange,
  onNumberInput,
  onPadNumber,
  onArtistInput,
  onArtistPaste,
  onArtistKeyDown,
  onCopyArtist,
  onRemoveArtist,
  onCopyAllArtists,
  onApplyVoiceActorsToAll,
  onCopyVoiceActorsFromPrevious,
  onCopyFirstTrackVoiceActorsToAll,
  onSelectOutputFolder,
  onExport,
  onStartOver,
}: SimpleWizardProps) {
  const currentStep = wizardStep === 'complete' ? 4 : wizardStep;
  const hasTracks = tracks.length > 0;
  const step2ScrollRef = useRef<HTMLDivElement>(null);
  const [showStep2ScrollHint, setShowStep2ScrollHint] = useState(false);

  useEffect(() => {
    if (wizardStep !== 2) {
      setShowStep2ScrollHint(false);
      return;
    }

    const el = step2ScrollRef.current;
    if (!el) return;

    const updateHint = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 4;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 12;
      setShowStep2ScrollHint(canScroll && !atBottom);
    };

    updateHint();
    el.addEventListener('scroll', updateHint, { passive: true });
    window.addEventListener('resize', updateHint);

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateHint)
      : null;
    observer?.observe(el);

    return () => {
      el.removeEventListener('scroll', updateHint);
      window.removeEventListener('resize', updateHint);
      observer?.disconnect();
    };
  }, [wizardStep]);

  const goNext = () => {
    if (wizardStep === 1 && hasTracks) onStepChange(2);
    else if (wizardStep === 2) onStepChange(3);
    else if (wizardStep === 3) onStepChange(4);
  };

  const goBack = () => {
    if (wizardStep === 2) onStepChange(1);
    else if (wizardStep === 3) onStepChange(2);
    else if (wizardStep === 4) onStepChange(3);
  };

  const handleStepClick = (step: StepNumber) => {
    if (step < currentStep) {
      onStepChange(step);
    }
  };

  if (wizardStep === 'complete') {
    return (
      <div class="flex min-h-0 flex-1 flex-col bg-white">
        <div class="flex flex-1 flex-col items-center justify-center overflow-auto p-8">
          <div class="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white px-8 py-10 text-center shadow-sm">
            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={36} />
            </div>
            <h2 class="mt-5 text-2xl font-bold text-zinc-900">保存が完了しました</h2>
            <p class="mt-3 text-sm leading-6 text-zinc-600">
              {savedCount}件の音声を保存しました。
              {exportSettings.outputPath && (
                <>
                  <br />
                  <span class="mt-1 inline-block font-medium text-zinc-800">
                    保存先: {exportSettings.outputPath}
                  </span>
                </>
              )}
            </p>
            <button
              type="button"
              onClick={onStartOver}
              class="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Plus size={20} />
              続けて別の作品を編集する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col bg-white">
      <StepIndicator currentStep={currentStep} onStepClick={handleStepClick} />

      <div class="border-b border-zinc-100 bg-white px-6 py-3">
        <p class="mx-auto max-w-3xl text-sm text-zinc-600">{stepDescriptions[currentStep]}</p>
      </div>

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        {wizardStep === 1 && (
          <div class="flex-1 overflow-auto">
          <div class="flex min-h-full items-center justify-center p-8">
            <div class="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white px-8 py-10 text-center shadow-sm">
              <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <FileAudio size={32} />
              </div>
              <h2 class="mt-5 text-xl font-bold text-zinc-900">音声を選びましょう</h2>
              <p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-600">
                1つずつ選ぶことも、作品のフォルダをまとめて選ぶこともできます。
                フォルダ内にあるカバー画像も自動で探します。
              </p>

              <div class="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onPickAudioFiles}
                  disabled={!isFfmpegReady || isProcessing}
                  class="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload size={20} />
                  ファイルを選ぶ
                </button>
                <button
                  type="button"
                  onClick={onPickDirectories}
                  disabled={!isFfmpegReady || isProcessing}
                  class="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-3 text-base font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FolderOpen size={20} />
                  フォルダを選ぶ
                </button>
              </div>

              {!isFfmpegReady && (
                <p class="mt-4 text-sm font-medium text-blue-700">
                  音声機能を準備しています。終わるまで少しお待ちください。
                </p>
              )}

              {isProcessing && (
                <p class="mt-4 text-sm font-medium text-blue-700">
                  音声を読み込んでいます…
                </p>
              )}

              {hasTracks && !isProcessing && (
                <p class="mt-5 text-sm font-medium text-emerald-700">
                  {tracks.length}件の音声を読み込みました。「次へ」を押して続けてください。
                </p>
              )}

              <div class="mt-7 border-t border-zinc-100 pt-5 text-sm text-zinc-500">
                ここへ音声ファイルやフォルダをドラッグ＆ドロップしても追加できます
                <div class="mt-1 text-xs text-zinc-400">対応形式：WAV / MP3 / FLAC / M4A</div>
              </div>
            </div>
          </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div class="relative flex min-h-0 flex-1 flex-col">
            <div ref={step2ScrollRef} class="min-h-0 flex-1 overflow-auto px-6 py-5 pb-10">
              <div class="mx-auto max-w-3xl">
                <h2 class="text-lg font-bold text-zinc-900">音声作品の情報</h2>
                {!albumData.albumTitle && (
                  <p class="mt-1 text-sm text-amber-700">
                    音声作品名が空です。保存時にフォルダ名に使われるので、入力をおすすめします。
                  </p>
                )}
                <p class="mt-2 text-sm text-zinc-500">
                  カバー画像のほか、下にスクロールすると発売日やタグも入力できます。
                </p>
                <div class="mt-5">
                  <AlbumInfoForm
                    mode="simple"
                    albumData={albumData}
                    artworkSourceLabel={artworkSourceLabel}
                    getChipColor={getChipColor}
                    onSelectArtwork={onSelectArtwork}
                    onClearArtwork={onClearArtwork}
                    onAlbumFieldChange={onAlbumFieldChange}
                    onTagInput={onTagInput}
                    onTagKeyDown={onTagKeyDown}
                    onRemoveTag={onRemoveTag}
                    showFieldHints
                    compactLayout
                  />
                </div>
              </div>
            </div>

            {showStep2ScrollHint && (
              <div
                class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-white via-white/95 to-transparent"
                aria-hidden="true"
              >
                <div class="flex items-end justify-center gap-1.5 pb-3 text-sm font-medium text-blue-600">
                  <ChevronDown size={18} class="animate-bounce" />
                  下に続きがあります
                </div>
              </div>
            )}
          </div>
        )}

        {wizardStep === 3 && (
          <div class="flex min-h-0 flex-1 flex-col">
            <div class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
              <p class="text-sm text-zinc-600">
                {tracks.length}件のトラックが読み込まれています
              </p>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={onPickAudioFiles}
                  disabled={!isFfmpegReady || isProcessing}
                  class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <Upload size={15} />
                  ファイルを追加
                </button>
                <button
                  type="button"
                  onClick={onPickDirectories}
                  disabled={!isFfmpegReady || isProcessing}
                  class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <FolderOpen size={15} />
                  フォルダを追加
                </button>
              </div>
            </div>
            {hasTracks ? (
              <TrackTable
                mode="simple"
                tracks={tracks}
                isProcessing={isProcessing}
                isFfmpegReady={isFfmpegReady}
                getChipColor={getChipColor}
                onPickAudioFiles={onPickAudioFiles}
                onPickDirectories={onPickDirectories}
                onTrackDelete={onTrackDelete}
                onTrackChange={onTrackChange}
                onNumberInput={onNumberInput}
                onPadNumber={onPadNumber}
                onArtistInput={onArtistInput}
                onArtistPaste={onArtistPaste}
                onArtistKeyDown={onArtistKeyDown}
                onCopyArtist={onCopyArtist}
                onRemoveArtist={onRemoveArtist}
                onCopyAllArtists={onCopyAllArtists}
                onApplyVoiceActorsToAll={onApplyVoiceActorsToAll}
                onCopyVoiceActorsFromPrevious={onCopyVoiceActorsFromPrevious}
                onCopyFirstTrackVoiceActorsToAll={onCopyFirstTrackVoiceActorsToAll}
              />
            ) : (
              <div class="flex flex-1 items-center justify-center p-8 text-center">
                <div>
                  <p class="text-zinc-600">トラックがありません。音声を追加するか、前のステップに戻ってください。</p>
                  <button
                    type="button"
                    onClick={() => onStepChange(1)}
                    class="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    ← 音声を選ぶステップに戻る
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {wizardStep === 4 && (
          <div class="flex-1 overflow-auto">
          <div class="mx-auto max-w-lg p-6">
            <div class="flex items-start gap-3">
              <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Save size={22} />
              </div>
              <div>
                <h2 class="text-xl font-bold text-zinc-900">編集した音声を保存</h2>
                <p class="mt-1 text-sm leading-5 text-zinc-600">
                  保存する場所を選ぶだけで、おすすめ設定を使って保存します。
                </p>
              </div>
            </div>

            <div class="mt-6">
              <label class="block text-sm font-semibold text-zinc-800">保存先フォルダ</label>
              <div class="mt-2 flex gap-2">
                <div class="min-w-0 flex-1 truncate rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">
                  {exportSettings.outputPath || 'まだ選ばれていません'}
                </div>
                <button
                  type="button"
                  onClick={onSelectOutputFolder}
                  class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <FolderOpen size={17} />
                  選ぶ
                </button>
              </div>
              {exportSettings.outputPath && (
                <p class="mt-2 text-xs leading-5 text-zinc-500">
                  選んだ場所の中に、サークル名・音声作品名のフォルダを作って保存します。
                </p>
              )}
            </div>

            <div class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div class="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <ShieldCheck size={18} />
                おすすめ設定
              </div>
              <dl class="mt-3 grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
                <dt class="text-emerald-700">保存形式</dt>
                <dd class="font-medium text-emerald-950">MP3</dd>
                <dt class="text-emerald-700">音質</dt>
                <dd class="font-medium text-emerald-950">高</dd>
                <dt class="text-emerald-700">同名ファイル</dt>
                <dd class="font-medium text-emerald-950">元を残して別名で保存</dd>
              </dl>
            </div>

            <p class="mt-4 text-sm text-zinc-600">
              {tracks.length}件の音声を保存します。
            </p>
          </div>
          </div>
        )}
      </div>

      {/* ナビゲーションフッター */}
      <div class="shrink-0 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
        <div class="mx-auto flex max-w-3xl items-center justify-between">
          {wizardStep > 1 ? (
            <button
              type="button"
              onClick={goBack}
              class="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              <ArrowLeft size={18} />
              戻る
            </button>
          ) : (
            <div />
          )}

          {wizardStep === 4 ? (
            <button
              type="button"
              onClick={onExport}
              disabled={!exportSettings.outputPath || !hasTracks || !isFfmpegReady || isProcessing}
              class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={20} />
              保存を開始
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={
                (wizardStep === 1 && !hasTracks)
                || isProcessing
              }
              class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              次へ
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
