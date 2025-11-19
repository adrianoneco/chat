import { storage } from '../server/storage';

async function run() {
  try {
    const webhooks = await storage.getWebhooks();
    if (!webhooks || webhooks.length === 0) {
      console.log('No webhooks found');
      return;
    }

    for (const wh of webhooks) {
      console.log('Testing webhook:', wh.id, wh.url);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const payload = {
          event: 'test.webhook.script',
          timestamp: new Date().toISOString(),
          data: { test: true },
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(wh.headers || {}),
        };

        if (wh.authType === 'bearer' && wh.apiToken) {
          headers['Authorization'] = `Bearer ${wh.apiToken}`;
        } else if (wh.authType === 'jwt' && wh.jwtToken) {
          headers['Authorization'] = `Bearer ${wh.jwtToken}`;
        }
        // fallback to GLOBAL_API_KEY if no token configured on webhook
        if (!headers['Authorization'] && process.env.GLOBAL_API_KEY) {
          headers['Authorization'] = `Bearer ${process.env.GLOBAL_API_KEY}`;
        }

        const res = await fetch(wh.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const text = await res.text();
        console.log(`=> ${wh.id} responded: ${res.status} ${res.statusText}`);
        console.log('Response body:', text.slice(0, 200));
      } catch (err: any) {
        console.error(`=> ${wh.id} error:`, err.message || err);
      }
    }
  } catch (err) {
    console.error('Error listing webhooks:', err);
  }
}

run();
