import { openUrl } from '@tauri-apps/plugin-opener';
import { X } from 'lucide-preact';
import licenseText from '../../LICENSE?raw';
import thirdPartyNoticesText from '../../THIRD-PARTY-NOTICES.md?raw';
import privacyPolicyText from '../../PRIVACY.md?raw';
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
  if (!isOpen) {
    return null;
  }

  const tabClass = (tab: AboutTab) => (
    `px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${activeTab === tab
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400'
    }`
  );

  return (
    <div class="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm bg-black/30 animate-in fade-in duration-200">
      <div class="bg-white rounded-xl shadow-2xl w-[720px] max-w-[95vw] max-h-[90vh] overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        <div class="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-zinc-800">このアプリについて</h2>
            <div class="text-xs text-zinc-500 mt-1">
              {appName}{appVersion ? ` v${appVersion}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            class="p-2 -mr-2 -mt-2 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>

        <div class="px-6 pt-4">
          <div class="flex flex-wrap gap-2">
            <button onClick={() => onTabChange('overview')} class={tabClass('overview')}>
              概要
            </button>
            <button onClick={() => onTabChange('license')} class={tabClass('license')}>
              ライセンス
            </button>
            <button onClick={() => onTabChange('thirdParty')} class={tabClass('thirdParty')}>
              サードパーティ
            </button>
            <button onClick={() => onTabChange('privacy')} class={tabClass('privacy')}>
              プライバシー
            </button>
          </div>
        </div>

        <div class="px-6 pb-6 pt-4 overflow-auto max-h-[70vh]">
          {activeTab === 'overview' && (
            <div class="space-y-4 text-sm text-zinc-700">
              <div class="space-y-1">
                <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">製作者</div>
                <div>Noguchi Yuuki</div>
              </div>

              <div class="flex flex-wrap gap-2">
                <button
                  onClick={() => { void openUrl('https://github.com/iLickeyPro/VoiceTagEditor').catch(() => { }); }}
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 text-xs font-medium hover:bg-zinc-50 hover:border-zinc-400 transition-all shadow-sm"
                >
                  GitHub
                </button>
                <button
                  onClick={() => { void openUrl('https://github.com/iLickeyPro/VoiceTagEditor/issues').catch(() => { }); }}
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 text-xs font-medium hover:bg-zinc-50 hover:border-zinc-400 transition-all shadow-sm"
                >
                  Issues
                </button>
              </div>

              <div class="text-xs text-zinc-600 leading-relaxed">
                <p>
                  {mode === 'simple'
                    ? '本アプリはパソコンの中だけで動作します。音声を扱うために必要な機能は、初回にアプリが自動で準備します。'
                    : '本アプリはローカル環境で動作し、音声ファイルの解析・変換には OS にインストール済みの FFmpeg を利用します。'}
                </p>
                <p class="mt-1">データの外部送信は行いません（詳細は「プライバシー」タブを参照してください）。</p>
              </div>
            </div>
          )}

          {activeTab === 'license' && (
            <pre class="whitespace-pre-wrap text-xs text-zinc-700 font-mono bg-zinc-50 border border-zinc-200 rounded-lg p-4">
              {licenseText}
            </pre>
          )}

          {activeTab === 'thirdParty' && (
            <pre class="whitespace-pre-wrap text-xs text-zinc-700 font-mono bg-zinc-50 border border-zinc-200 rounded-lg p-4">
              {thirdPartyNoticesText}
            </pre>
          )}

          {activeTab === 'privacy' && (
            <pre class="whitespace-pre-wrap text-xs text-zinc-700 font-mono bg-zinc-50 border border-zinc-200 rounded-lg p-4">
              {privacyPolicyText}
            </pre>
          )}
        </div>

        <div class="px-6 pb-6 flex justify-end">
          <button
            onClick={onClose}
            class="px-4 py-2 border border-zinc-300 rounded-md text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
