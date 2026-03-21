export function usePlatform() {
  const isNative = window?.Capacitor?.isNativePlatform?.() ?? false;
  const platform = window?.Capacitor?.getPlatform?.();
  const isIOS = platform === 'ios';
  const isAndroid = platform === 'android';
  const isWeb = !isNative;

  return { isNative, isIOS, isAndroid, isWeb };
}