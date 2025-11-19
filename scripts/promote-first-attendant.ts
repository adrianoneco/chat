import { storage } from '../server/storage';

async function run() {
  try {
    const attendants = await storage.getUsersByRole('attendant');
    if (!attendants || attendants.length === 0) {
      console.log('No attendants found to promote');
      return;
    }

    const first = attendants[0];
    console.log('Promoting:', first.id, first.email);
    const updated = await storage.updateUser(first.id, { role: 'admin' });
    console.log('Promoted:', updated?.id, updated?.role);
  } catch (err) {
    console.error('Error promoting user:', err);
    process.exitCode = 1;
  }
}

run();
