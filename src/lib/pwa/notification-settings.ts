const databaseName = 'nusantara-notification-settings';
const storeName = 'settings';
const enabledKey = 'enabled';

function openSettings(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onerror = () => reject(request.error ?? Error('Notification settings are unavailable'));
    request.onblocked = () => {
      blocked = true;
      reject(Error('Notification settings are locked by another app window'));
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (blocked) { database.close(); return; }
      resolve(database);
    };
  });
}

/** Shared with the service worker: browser permission alone cannot override an explicit opt-out. */
export async function readNotificationsEnabled(): Promise<boolean> {
  const database = await openSettings();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).get(enabledKey);
      transaction.oncomplete = () => {
        if (request.result === undefined) { resolve(true); return; }
        resolve(request.result === true);
      };
      transaction.onabort = () => reject(transaction.error ?? Error('Notification settings could not be read'));
    });
  } finally { database.close(); }
}

export async function writeNotificationsEnabled(enabled: boolean): Promise<void> {
  const database = await openSettings();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put(enabled, enabledKey);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? Error('Notification settings could not be saved'));
    });
  } finally { database.close(); }
}

/** The application cannot revoke browser permission; unsubscribe and close this origin's notifications. */
export async function stopPushNotifications(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  await subscription?.unsubscribe();
  const notifications = await registration?.getNotifications() ?? [];
  for (const notification of notifications) notification.close();
}
