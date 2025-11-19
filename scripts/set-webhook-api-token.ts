import { storage } from '../server/storage';

async function run() {
  try {
    const id = process.argv[2];
    const token = process.env.GLOBAL_API_KEY;
    if (!token) {
      console.error('GLOBAL_API_KEY not set in env');
      process.exit(1);
    }

    if (id) {
      const updated = await storage.updateWebhook(id, { apiToken: token });
      console.log('Updated webhook:', id, !!updated);
    } else {
      const all = await storage.getWebhooks();
      for (const wh of all) {
        await storage.updateWebhook(wh.id, { apiToken: token });
        console.log('Updated webhook:', wh.id);
      }
    }
  } catch (err) {
    console.error('Error updating webhook(s):', err);
    process.exitCode = 1;
  }
}

run();
