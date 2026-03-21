export function usePlatform() {
  const isNative = window?.Capacitor?.isNativePlatform?.() ?? false;
  const platform = window?.Capacitor?.getPlatform?.();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroidDevice = /Android/i.test(userAgent);
  const isIOS = platform === 'ios' || (!isNative && isIOSDevice);
  const isAndroid = platform === 'android' || (!isNative && isAndroidDevice);
  const isWeb = !isNative;

  return { isNative, isIOS, isAndroid, isWeb };
}