import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertStoreDirectory, createDispatcher, createServerHandler, JsonSubscriptionStore, loadRegionCodes } from './push-service.mjs';

function requiredEnvironment(name, environment) {
  const value = environment[name];
  if (!value) throw new Error(name + ' is required');
  return value;
}

export async function startPushServer(environment = process.env) {
  const origin = requiredEnvironment('PUSH_ALLOWED_ORIGIN', environment);
  const subscriberToken = requiredEnvironment('PUSH_SUBSCRIBER_TOKEN', environment);
  const adminToken = requiredEnvironment('PUSH_ADMIN_TOKEN', environment);
  const vapidPublicKey = requiredEnvironment('VAPID_PUBLIC_KEY', environment);
  const vapidPrivateKey = requiredEnvironment('VAPID_PRIVATE_KEY', environment);
  const vapidSubject = requiredEnvironment('VAPID_SUBJECT', environment);
  const regionFile = requiredEnvironment('PUSH_REGION_FILE', environment);
  const storeFile = environment.PUSH_STORE_FILE ?? './var/subscriptions.json';
  const port = Number(environment.PORT ?? 8787);
  if (subscriberToken.length < 32 || adminToken.length < 32 || subscriberToken === adminToken) throw new Error('Use distinct random tokens of at least 32 characters');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');
  const regionCodes = await loadRegionCodes(resolve(regionFile));
  if (regionCodes.size === 0) throw new Error('The region code file is empty');
  const store = new JsonSubscriptionStore(resolve(storeFile));
  await assertStoreDirectory(resolve(storeFile));
  const webPush = await import('web-push');
  webPush.default.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const dispatch = createDispatcher({
    store,
    regionCodes,
    deliver: (subscription, payload, options) => webPush.default.sendNotification(subscription, JSON.stringify(payload), options)
  });
  const server = createServer(createServerHandler({ origin, subscriberToken, adminToken, regionCodes, store, dispatch }));
  server.listen(port);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startPushServer().catch(error => {
    console.error('Push service startup failed:', error.message);
    process.exitCode = 1;
  });
}
