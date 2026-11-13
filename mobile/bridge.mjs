import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { createSaveQueue } from './save-queue.mjs';

// This bundle is included only in the installed apps, never by the website.
if (Capacitor.isNativePlatform()) {
  const saves = createSaveQueue(value => Preferences.set({ key: 'prompter.v1', value }));
  let wakeQueue = Promise.resolve();
  window.PromptNative = {
    async load() {
      const { value } = await Preferences.get({ key: 'prompter.v1' });
      if (value !== null) {
        const state = JSON.parse(value);
        if (!state || typeof state !== 'object' || typeof state.text !== 'string') {
          throw new Error('Saved script is unreadable');
        }
      }
      return value;
    },
    save: saves.save,
    setAwake(awake) {
      // Serialize transitions so a late keepAwake cannot undo allowSleep.
      wakeQueue = wakeQueue.catch(() => {}).then(() => awake ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
      return wakeQueue;
    },
    async exportScript(text) {
      const { uri } = await Filesystem.writeFile({
        path: 'exports/freetoprompt-script.txt', directory: Directory.Cache,
        data: text, encoding: Encoding.UTF8, recursive: true,
      });
      await Share.share({ title: 'Free to Prompt', files: [uri], dialogTitle: 'Export Script' });
    },
    async listen({ onActive, onBack }) {
      await App.addListener('appStateChange', ({ isActive }) => onActive(isActive));
      if (Capacitor.getPlatform() === 'android') {
        await App.addListener('backButton', () => {
          if (!onBack()) App.minimizeApp().catch(() => {});
        });
      }
    },
  };
  document.documentElement.classList.add('native-app');
}
