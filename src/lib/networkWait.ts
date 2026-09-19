/**
 * Shared connectivity-awareness helpers for upload retry loops. A failed
 * request while the tab is backgrounded or the device is offline says
 * nothing about whether the request itself is retryable — it just means
 * now is the wrong moment to try. These let a retry loop pause until
 * conditions are actually right again instead of hammering a dead
 * connection until an attempt budget runs out.
 */

/**
 * Resolves once the document is visible again (tab foregrounded, screen
 * unlocked), or after maxWaitMs if it never is. Resolves immediately if the
 * document is already visible or this isn't a browser tab context at all.
 */
export function waitForVisible(maxWaitMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimeout(timeoutId);
      resolve();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") finish();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const timeoutId = setTimeout(finish, maxWaitMs);
  });
}

/**
 * Resolves once the browser reports the device back online, or after
 * maxWaitMs if it never does. Resolves immediately if already online or
 * this isn't a browser context at all.
 */
export function waitForOnline(maxWaitMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("online", onOnline);
      clearTimeout(timeoutId);
      resolve();
    };
    const onOnline = () => finish();
    window.addEventListener("online", onOnline);
    const timeoutId = setTimeout(finish, maxWaitMs);
  });
}

/**
 * Pauses for a backgrounded tab and/or offline device, in that order, then
 * gives the connection a moment to settle. Call this between retry attempts
 * for any network-class failure before actually retrying.
 *
 * Returns true if it actually had to wait out a real backgrounded/offline
 * period. Callers use that to tell "the device was genuinely unreachable"
 * (worth a fresh retry budget once it's back) apart from "the device was
 * online and visible the whole time and it still failed" (a live failure
 * that should count toward a bounded retry ceiling — retrying forever
 * accomplishes nothing if the failure isn't actually about connectivity).
 */
export async function pauseForConnectivity(context: string, startByte: number, totalBytes: number, logger: { warn: (...args: any[]) => void }): Promise<boolean> {
  let waited = false;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    logger.warn(`[${context}] Tab is backgrounded mid-upload (byte ${startByte}/${totalBytes}); pausing retries until it's foregrounded again.`);
    await waitForVisible(5 * 60 * 1000);
    waited = true;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    logger.warn(`[${context}] Device reports offline mid-upload (byte ${startByte}/${totalBytes}); pausing retries until connectivity returns.`);
    await waitForOnline(5 * 60 * 1000);
    waited = true;
  }
  await new Promise((r) => setTimeout(r, 2000));
  return waited;
}
