import { useEffect } from 'preact/hooks';
import { openUrl } from '@tauri-apps/plugin-opener';
import { X } from 'lucide-preact';
import licenseText from '../../LICENSE?raw';
import thirdPartyNoticesText from '../../THIRD-PARTY-NOTICES.md?raw';
import privacyPolicyText from '../../PRIVACY.md?raw';
import { useI18n } from '../i18n';
import type { AppMode } from '../types';

export type AboutTab = 'overview' | 'license' | 'thirdParty' | 'privacy';

interface AboutDialogProps {
  mode: AppMode;
  isOpen: boolean;
  activeTab: AboutTab;
  appName: string;
  appVersion: string;
  onTabChange: (tab: AboutTab) => void;
  onClose: () => void;
}

export function AboutDialog({
  mode,
  isOpen,
  activeTab,
  appName,
  appVersion,
  onTabChange,
  onClose,
}: AboutDialogProps) {
  const { t, locale } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const tabClass = (tab: AboutTab) => (
    `rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === tab
      ? 'border-blue-600 bg-blue-600 text-white'
      : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
    }`
  );

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div class="max-h-[90vh] w-[720px] max-w-[95vw] scale-100 overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div class="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 pb-4 pt-6">
          <div>
            <h2 class="text-lg font-semibold text-zinc-800">{t.about.title}</h2>
            <div class="mt-1 text-xs text-zinc-500">
              {appName}{appVersion ? ` v${appVersion}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            class="-mr-2 -mt-2 rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label={t.common.close}
          >
            <X size={16} />
          </button>
        </div>

        <div class="px-6 pt-4">
          <div class="flex flex-wrap gap-2">
            <button type="button" onClick={() => onTabChange('overview')} class={tabClass('overview')}>
              {t.about.tabOverview}
            </button>
            <button type="button" onClick={() => onTabChange('license')} class={tabClass('license')}>
              {t.about.tabLicense}
            </button>
            <button type="button" onClick={() => onTabChange('thirdParty')} class={tabClass('thirdParty')}>
              {t.about.tabThirdParty}
            </button>
            <button type="button" onClick={() => onTabChange('privacy')} class={tabClass('privacy')}>
              {t.about.tabPrivacy}
            </button>
          </div>
        </div>

        <div class="max-h-[65vh] overflow-auto px-6 pb-6 pt-4">
          {activeTab === 'overview' && (
            <div class="space-y-4 text-sm text-zinc-700">
              <div class="space-y-1">
                <div class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {t.about.authorLabel}
                </div>
                <div>Noguchi Yuuki</div>
              </div>

              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { void openUrl('https://github.com/iLickeyPro/VoiceTagEditor').catch(() => { }); }}
                  class="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:border-zinc-400 hover:bg-zinc-50"
                >
                  GitHub
                </button>
                <button
                  type="button"
                  onClick={() => { void openUrl('https://github.com/iLickeyPro/VoiceTagEditor/issues').catch(() => { }); }}
                  class="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-all hover:border-zinc-400 hover:bg-zinc-50"
                >
                  Issues
                </button>
              </div>

              <div class="text-xs leading-relaxed text-zinc-600">
                <p>
                  {mode === 'simple' ? t.about.overviewSimple : t.about.overviewAdvanced}
                </p>
                <p class="mt-1">{t.about.privacyNote}</p>
              </div>
            </div>
          )}

          {activeTab === 'license' && (
            <pre class="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs text-zinc-700">
              {licenseText}
            </pre>
          )}

          {activeTab === 'thirdParty' && (
            <pre class="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs text-zinc-700">
              {thirdPartyNoticesText}
            </pre>
          )}

          {activeTab === 'privacy' && (
            <div class="space-y-3">
              {locale !== 'ja' && (
                <div class="rounded-lg border border-blue-100 bg-blue-50/70 p-3.5 text-xs leading-relaxed text-blue-950">
                  <div class="font-semibold">{t.about.privacySummaryTitle}</div>
                  <p class="mt-1 text-blue-900">{t.about.privacySummaryBody}</p>
                </div>
              )}
              <pre class="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs text-zinc-700">
                {privacyPolicyText}
              </pre>
            </div>
          )}
        </div>

        <div class="flex justify-end border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            class="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}
