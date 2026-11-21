import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileAudio,
  Folder,
  FolderOpen,
  Plus,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-preact';
import { useI18n } from '../i18n';
import type {
  AlbumData,
  ChipColor,
  ExportSettings,
  Track,
  WizardStep,
} from '../types';
import { AlbumInfoForm } from './AlbumInfoForm';
import { StepIndicator, type StepNumber } from './StepIndicator';
import { InfoHint, Tooltip } from './Tooltip';
import { TrackTable } from './TrackTable';

interface SimpleWizardProps {
  wizardStep: WizardStep;
  tracks: Track[];
  albumData: AlbumData;
  exportSettings: ExportSettings;
  lastSavedFolderPath: string;
  artworkSourceLabel: string;
  isProcessing: boolean;
  isFfmpegReady: boolean;
  canUndo: boolean;
  canRedo: boolean;
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
  onMoveTrack: (trackId: string, direction: 'up' | 'down') => void;
  onReorderTrack: (fromIndex: number, toIndex: number) => void;
  onInternalDragChange: (dragging: boolean) => void;
  onRenumberTracks: () => void;
  onSortTracks: () => void;
  onBatchTransformTitles: (transform: (title: string) => string) => void;
  onUndo: () => void;
  onRedo: () => void;
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
  onOpenOutputFolder: (path: string) => void;
  onExport: () => void;
  onStartOver: () => void;
}

const SUPPORTED_FORMATS = ['WAV', 'MP3', 'FLAC', 'M4A'] as const;

export function SimpleWizard({
  wizardStep,
  tracks,
  albumData,
  exportSettings,
  lastSavedFolderPath,
  artworkSourceLabel,
  isProcessing,
  isFfmpegReady,
  canUndo,
  canRedo,
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
  onMoveTrack,
  onReorderTrack,
  onInternalDragChange,
  onRenumberTracks,
  onSortTracks,
  onBatchTransformTitles,
  onUndo,
  onRedo,
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
  onOpenOutputFolder,
  onExport,
  onStartOver,
}: SimpleWizardProps) {
  const { t, fmt } = useI18n();
  const currentStep = wizardStep === 'complete' ? 4 : wizardStep;
  const hasTracks = tracks.length > 0;

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
    const displayPath = lastSavedFolderPath || exportSettings.outputPath;
    return (
      <div class="flex min-h-0 flex-1 flex-col bg-white">
        <div class="flex flex-1 flex-col items-center justify-center overflow-auto p-8">
          <div class="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white px-8 py-10 text-center shadow-xs">
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={32} />
            </div>
            <h2 class="mt-4 text-xl font-bold text-zinc-900">{t.wizard.complete.title}</h2>
            <div class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <FileAudio size={13} />
              <span>{savedCount}</span>
            </div>
            {displayPath && (
              <div
                class="mt-3 truncate rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-600"
                title={displayPath}
              >
                {displayPath}
              </div>
            )}
            <div class="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
              {displayPath && (
                <button
                  type="button"
                  onClick={() => onOpenOutputFolder(displayPath)}
                  class="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-xs transition-colors hover:bg-zinc-50"
                >
                  <FolderOpen size={17} />
                  {t.wizard.complete.openOutputFolder}
                </button>
              )}
              <button
                type="button"
                onClick={onStartOver}
                class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
              >
                <Plus size={17} />
                {t.wizard.complete.editAnotherWork}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const outputFolderLeaf = exportSettings.outputPath
    ? exportSettings.outputPath.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || exportSettings.outputPath
    : '';

  return (
    <div class="flex min-h-0 flex-1 flex-col bg-white">
      <StepIndicator currentStep={currentStep} onStepClick={handleStepClick} />

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        {wizardStep === 1 && (
          <div class="flex-1 overflow-auto">
            <div class="flex min-h-full items-center justify-center p-8">
              <div class="w-full max-w-lg rounded-3xl border-2 border-dashed border-zinc-200 bg-white px-8 py-12 text-center transition-colors hover:border-blue-300">
                <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <FileAudio size={28} />
                </div>
                <div class="mt-4 flex items-center justify-center gap-1.5">
                  <h2 class="text-lg font-bold text-zinc-900">{t.wizard.step1.title}</h2>
                  <InfoHint text={t.wizard.step1.description} />
                </div>

                <div class="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    onClick={onPickAudioFiles}
                    disabled={!isFfmpegReady || isProcessing}
                    class="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload size={17} />
                    {t.wizard.step1.pickFiles}
                  </button>
                  <button
                    type="button"
                    onClick={onPickDirectories}
                    disabled={!isFfmpegReady || isProcessing}
                    class="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-xs transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FolderOpen size={17} />
                    {t.wizard.step1.pickFolder}
                  </button>
                </div>

                {!isFfmpegReady && (
                  <p class="mt-4 text-xs font-medium text-blue-700">
                    {t.wizard.step1.preparingAudio}
                  </p>
                )}

                {isProcessing && (
                  <p class="mt-4 text-xs font-medium text-blue-700">
                    {t.wizard.step1.loadingAudio}
                  </p>
                )}

                {hasTracks && !isProcessing && (
                  <div class="mt-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={14} />
                    <span>{fmt(t.wizard.step3.trackCount, { count: tracks.length })}</span>
                  </div>
                )}

                <div class="mt-6 flex flex-wrap items-center justify-center gap-1.5">
                  {SUPPORTED_FORMATS.map((fmtName) => (
                    <span
                      key={fmtName}
                      class="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-500"
                    >
                      {fmtName}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div class="flex min-h-0 flex-1 items-center justify-center overflow-auto px-6 py-6">
            <div class="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
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
                compactLayout
              />
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div class="flex min-h-0 flex-1 flex-col">
            {hasTracks ? (
              <TrackTable
                mode="simple"
                tracks={tracks}
                isProcessing={isProcessing}
                isFfmpegReady={isFfmpegReady}
                canUndo={canUndo}
                canRedo={canRedo}
                getChipColor={getChipColor}
                onPickAudioFiles={onPickAudioFiles}
                onPickDirectories={onPickDirectories}
                onTrackDelete={onTrackDelete}
                onTrackChange={onTrackChange}
                onMoveTrack={onMoveTrack}
                onReorderTrack={onReorderTrack}
                onInternalDragChange={onInternalDragChange}
                onRenumberTracks={onRenumberTracks}
                onSortTracks={onSortTracks}
                onBatchTransformTitles={onBatchTransformTitles}
                onUndo={onUndo}
                onRedo={onRedo}
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
                <button
                  type="button"
                  onClick={() => onStepChange(1)}
                  class="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <ArrowLeft size={16} />
                  {t.steps.selectAudio}
                </button>
              </div>
            )}
          </div>
        )}

        {wizardStep === 4 && (
          <div class="flex flex-1 items-center justify-center overflow-auto p-6">
            <div class="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Save size={20} />
                  </div>
                  <h2 class="text-lg font-bold text-zinc-900">{t.wizard.step4.title}</h2>
                </div>
                <span class="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                  <FileAudio size={13} class="text-blue-600" />
                  <span class="tabular-nums">{tracks.length}</span>
                </span>
              </div>

              <div class="mt-5">
                <div class="flex items-center gap-1.5">
                  <label class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {t.wizard.step4.outputFolderLabel}
                  </label>
                  <InfoHint text={t.wizard.step4.outputFolderHint} />
                </div>
                <div class="mt-1.5 flex gap-2">
                  <div
                    class="min-w-0 flex-1 truncate rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                    title={exportSettings.outputPath || undefined}
                  >
                    {exportSettings.outputPath || t.wizard.step4.outputFolderEmpty}
                  </div>
                  <button
                    type="button"
                    onClick={onSelectOutputFolder}
                    class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <FolderOpen size={16} />
                    {t.common.choose}
                  </button>
                </div>

                {/* Visual folder path preview instead of prose */}
                {exportSettings.outputPath && (
                  <div class="mt-2.5 flex flex-wrap items-center gap-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    <Folder size={13} class="shrink-0 text-zinc-400" />
                    <span class="max-w-[9rem] truncate font-medium text-zinc-700">{outputFolderLeaf}</span>
                    {albumData.albumArtist && (
                      <>
                        <ChevronRight size={12} class="shrink-0 text-zinc-400" />
                        <span class="max-w-[9rem] truncate text-zinc-600">{albumData.albumArtist}</span>
                      </>
                    )}
                    {albumData.albumTitle && (
                      <>
                        <ChevronRight size={12} class="shrink-0 text-zinc-400" />
                        <span class="max-w-[10rem] truncate font-medium text-blue-700">{albumData.albumTitle}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Compact preset chips instead of a verbose definition list */}
              <div class="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-3">
                <Tooltip text={t.wizard.step4.subtitle} align="left">
                  <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                    <ShieldCheck size={15} class="text-emerald-600" />
                    {t.wizard.step4.recommendedTitle}
                  </span>
                </Tooltip>
                <div class="ml-auto flex flex-wrap items-center gap-1.5 text-xs font-medium">
                  <span class="rounded-md bg-white px-2 py-0.5 text-emerald-900 shadow-2xs">MP3</span>
                  <span class="rounded-md bg-white px-2 py-0.5 text-emerald-900 shadow-2xs">256 kbps</span>
                  <Tooltip text={t.wizard.step4.duplicateFilesValue} align="right">
                    <span class="rounded-md bg-white px-2 py-0.5 text-emerald-900 shadow-2xs">
                      {t.exportDialog.duplicateRename}
                    </span>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation footer */}
      <div class="shrink-0 border-t border-zinc-200 bg-zinc-50 px-6 py-2.5">
        <div class="mx-auto flex max-w-4xl items-center justify-between">
          {wizardStep > 1 ? (
            <button
              type="button"
              onClick={goBack}
              class="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-xs transition-colors hover:bg-zinc-50"
            >
              <ArrowLeft size={16} />
              {t.common.back}
            </button>
          ) : (
            <div />
          )}

          {wizardStep === 4 ? (
            <button
              type="button"
              onClick={onExport}
              disabled={!exportSettings.outputPath || !hasTracks || !isFfmpegReady || isProcessing}
              class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={17} />
              {t.wizard.step4.startSave}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={(wizardStep === 1 && !hasTracks) || isProcessing}
              class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.common.next}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
