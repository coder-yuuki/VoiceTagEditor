import { useEffect, useRef, useState } from 'preact/hooks';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  FolderPlus,
  Globe,
  HelpCircle,
  Info,
  MoreHorizontal,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-preact';
import { LOCALE_OPTIONS, useI18n } from '../i18n';
import type { AppMode } from '../types';
import { Tooltip } from './Tooltip';

interface AppToolbarProps {
  mode: AppMode;
  hasTracks: boolean;
  isFfmpegReady: boolean;
  isUpdateChecking: boolean;
  onModeChange: (mode: AppMode) => void;
  onSort: () => void;
  onPickAudioFiles: () => void;
  onPickDirectories: () => void;
  onCheckForUpdates: () => void;
  onShowAbout: () => void;
  onShowGuide: () => void;
  onClearAll: () => void;
  onExport: () => void;
}

export function AppToolbar({
  mode,
  hasTracks,
  isFfmpegReady,
  isUpdateChecking,
  onModeChange,
  onSort,
  onPickAudioFiles,
  onPickDirectories,
  onCheckForUpdates,
  onShowAbout,
  onShowGuide,
  onClearAll,
  onExport,
}: AppToolbarProps) {
  const { t, locale, setLocale } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  const buttonClass = 'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-xs transition-colors hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45';
  const iconButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 shadow-xs transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-45';
  const simple = mode === 'simple';
  const currentLocaleOption = LOCALE_OPTIONS.find((item) => item.code === locale) ?? LOCALE_OPTIONS[0];

  useEffect(() => {
    if (!showMenu && !showLanguageMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (showMenu && menuRef.current && target && !menuRef.current.contains(target)) {
        setShowMenu(false);
      }
      if (showLanguageMenu && languageMenuRef.current && target && !languageMenuRef.current.contains(target)) {
        setShowLanguageMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMenu(false);
        setShowLanguageMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu, showLanguageMenu]);

  const runMenuAction = (action: () => void) => {
    setShowMenu(false);
    action();
  };

  return (
    <header class="shrink-0 border-b border-zinc-200 bg-white px-4 py-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <Tooltip text={t.app.subtitle} align="left">
            <div class="mr-1.5 truncate text-sm font-bold tracking-tight text-zinc-900">
              VoiceTagEditor
            </div>
          </Tooltip>

          {!simple && (
            <>
              <Tooltip text={isFfmpegReady ? t.toolbar.addFilesTooltip : t.toolbar.waitForFfmpeg} align="left">
                <button
                  type="button"
                  onClick={onPickAudioFiles}
                  disabled={!isFfmpegReady}
                  class={buttonClass}
                >
                  <Upload size={14} />
                  <span>{t.toolbar.addFiles}</span>
                </button>
              </Tooltip>

              <Tooltip text={isFfmpegReady ? t.toolbar.addFolderTooltip : t.toolbar.waitForFfmpeg}>
                <button
                  type="button"
                  onClick={onPickDirectories}
                  disabled={!isFfmpegReady}
                  class={buttonClass}
                >
                  <FolderPlus size={14} />
                  <span>{t.toolbar.addFolder}</span>
                </button>
              </Tooltip>

              <Tooltip text={t.toolbar.sortTooltip}>
                <button
                  type="button"
                  onClick={onSort}
                  disabled={!hasTracks}
                  class={iconButtonClass}
                  aria-label={t.toolbar.sortTooltip}
                >
                  <ArrowUpDown size={15} />
                </button>
              </Tooltip>
            </>
          )}
        </div>

        <div class="flex shrink-0 items-center gap-1.5">
          {!simple && (
            <>
              <Tooltip text={t.toolbar.clearAll}>
                <button
                  type="button"
                  onClick={onClearAll}
                  disabled={!hasTracks}
                  class={`${iconButtonClass} text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700`}
                  aria-label={t.toolbar.clearAll}
                >
                  <Trash2 size={15} />
                </button>
              </Tooltip>
              <div class="mx-0.5 h-5 w-px bg-zinc-200" />
            </>
          )}

          {/* Language switcher */}
          <div class="relative" ref={languageMenuRef}>
            <Tooltip text={t.common.language}>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowLanguageMenu((current) => !current);
                }}
                class="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700 shadow-xs transition-colors hover:border-zinc-400 hover:bg-zinc-50"
                aria-expanded={showLanguageMenu}
                aria-label={t.common.language}
              >
                <Globe size={14} class="text-zinc-500" />
                <span>{currentLocaleOption.shortLabel}</span>
                <ChevronDown size={12} class="text-zinc-400" />
              </button>
            </Tooltip>
            {showLanguageMenu && (
              <div class="absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl">
                {LOCALE_OPTIONS.map((option) => {
                  const selected = option.code === locale;
                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => {
                        setLocale(option.code);
                        setShowLanguageMenu(false);
                      }}
                      class={`flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition-colors ${
                        selected
                          ? 'bg-blue-50 font-semibold text-blue-700'
                          : 'text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <span>{option.label}</span>
                      {selected && <Check size={14} class="shrink-0 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Tooltip text={t.toolbar.guideTooltip}>
            <button
              type="button"
              onClick={onShowGuide}
              class={iconButtonClass}
              aria-label={t.toolbar.guideTooltip}
            >
              <HelpCircle size={15} />
            </button>
          </Tooltip>

          {/* Overflow menu (available in both simple & advanced to keep header clean) */}
          <div class="relative" ref={menuRef}>
            <Tooltip text={t.toolbar.moreActions} align="right">
              <button
                type="button"
                onClick={() => {
                  setShowLanguageMenu(false);
                  setShowMenu((current) => !current);
                }}
                class={iconButtonClass}
                aria-expanded={showMenu}
                aria-label={t.toolbar.moreActions}
              >
                <MoreHorizontal size={16} />
              </button>
            </Tooltip>
            {showMenu && (
              <div class="absolute right-0 top-10 z-40 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => runMenuAction(onCheckForUpdates)}
                  disabled={isUpdateChecking}
                  class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <RefreshCw size={15} class={isUpdateChecking ? 'animate-spin' : ''} />
                  {t.toolbar.checkUpdates}
                </button>
                <button
                  type="button"
                  onClick={() => runMenuAction(onShowAbout)}
                  class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  <Info size={15} />
                  {t.toolbar.about}
                </button>
                {simple && (
                  <>
                    <div class="my-1 border-t border-zinc-100" />
                    <button
                      type="button"
                      onClick={() => runMenuAction(onClearAll)}
                      disabled={!hasTracks}
                      class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                      {t.toolbar.clearAllMenu}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div
            class="ml-0.5 flex h-8 items-center rounded-lg border border-zinc-300 bg-zinc-100 p-0.5"
            aria-label={t.toolbar.modeSwitchLabel}
          >
            <button
              type="button"
              onClick={() => onModeChange('simple')}
              class={`h-full whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-colors ${
                mode === 'simple' ? 'bg-white text-blue-700 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {t.toolbar.modeSimple}
            </button>
            <button
              type="button"
              onClick={() => onModeChange('advanced')}
              class={`h-full whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-colors ${
                mode === 'advanced' ? 'bg-white text-blue-700 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {t.toolbar.modeAdvanced}
            </button>
          </div>

          {!simple && (
            <Tooltip
              text={
                !isFfmpegReady
                  ? t.toolbar.waitForFfmpeg
                  : !hasTracks
                    ? t.toolbar.saveTooltipNoTracks
                    : t.toolbar.saveTooltipReady
              }
              align="right"
            >
              <button
                type="button"
                onClick={onExport}
                disabled={!hasTracks || !isFfmpegReady}
                class="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={14} />
                <span>{t.common.save}</span>
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </header>
  );
}
