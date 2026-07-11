/**
 * Media URL helper.
 *
 * Firebase Storage-emulator signed URLs are baked by the backend with a
 * 127.0.0.1 / localhost host. When the phone reaches the backend over LAN
 * (EXPO_PUBLIC_API_BASE_URL points at a LAN IP), that loopback host resolves to
 * the DEVICE itself and the image fails to load. Rewrite the media host to the
 * same host the app already uses for the API, so photos load over the same
 * network path (LAN in dev on a device, localhost on web / adb reverse).
 *
 * No-op for real (non-loopback) URLs — production storage URLs pass through.
 */
const API_HOST = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000')
  .replace(/^https?:\/\//, '')
  .split('/')[0]
  .split(':')[0];

export function mediaUri(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(
    /(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?/i,
    (_m, proto: string, _host: string, port: string | undefined) =>
      `${proto}${API_HOST}${port ?? ''}`,
  );
}
