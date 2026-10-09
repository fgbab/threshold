// The iPhone app's bridge to native features. scripts/build.mjs bundles it into www/native.js;
// game.js uses window.TH_NATIVE when it exists and the web APIs when it doesn't.
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';

if (Capacitor.isNativePlatform()) {
  const styles = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  window.TH_NATIVE = {
    impact: style => Haptics.impact({ style: styles[style] || ImpactStyle.Light }).catch(() => {}),
    save: (key, value) => Preferences.set({ key, value }).catch(() => {}),
    async restore(keys) {                 // put back progress iOS may have cleared from the web view's storage
      for (const key of keys) {
        const { value } = await Preferences.get({ key });
        if (value != null && localStorage.getItem(key) == null) localStorage.setItem(key, value);
      }
    },
    shareText: (text, url) => Share.share({ text, url }),
    async shareImage(dataUrl, text) {
      const { uri } = await Filesystem.writeFile({ path: 'threshold.png', data: dataUrl.split(',')[1], directory: Directory.Cache });
      await Share.share({ text, files: [uri] });
    },
    async remind(at, title, body) {       // one local notification; scheduling again replaces it
      const { display } = await LocalNotifications.requestPermissions();
      if (display !== 'granted') return false;
      await LocalNotifications.cancel({ notifications: [{ id: 303 }] }).catch(() => {});
      await LocalNotifications.schedule({ notifications: [{ id: 303, title, body, schedule: { at: new Date(at) } }] });
      return true;
    },
    ready: () => SplashScreen.hide().catch(() => {})
  };
}
