import { EvolutionAPIClient } from './evolution-api';
import type { IStorage } from './storage';

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  instanceNumber?: string;
}

export async function initializeEvolutionInstance(
  storage: IStorage,
  config: EvolutionConfig
): Promise<void> {
  console.log('[Evolution Init] Starting automatic instance initialization...');
  
  let { apiUrl, apiKey, instanceName, instanceNumber } = config;
  
  apiUrl = apiUrl.replace('https://https://', 'https://').replace('http://http://', 'http://');
  
  try {
    const evolutionClient = new EvolutionAPIClient({ apiUrl, apiKey });
    
    let existingChannel = await storage.getChannelByInstanceId(instanceName);
    
    if (existingChannel) {
      console.log('[Evolution Init] Channel already exists in database:', existingChannel.id);
      
      try {
        const status = await evolutionClient.getInstanceStatus(instanceName);
        console.log('[Evolution Init] Instance status:', status.instance?.state || status.instance?.status);
        
        const connectionState = status.instance?.state || status.instance?.status || 'disconnected';
        const isConnected = connectionState === 'open';
        
        await storage.updateChannel(existingChannel.id, {
          isActive: isConnected,
          config: {
            ...existingChannel.config,
            connectionStatus: connectionState,
            phoneNumber: instanceNumber || status.instance?.owner,
          },
        });
        
        console.log('[Evolution Init] Channel status updated');
      } catch (error: any) {
        console.warn('[Evolution Init] Could not fetch instance status:', error.message);
      }
    } else {
      console.log('[Evolution Init] Creating new channel and instance...');
      
      const adminUsers = await storage.getUsersByRole('admin');
      if (!adminUsers || adminUsers.length === 0) {
        throw new Error('No admin user found to create channel');
      }
      const adminUser = adminUsers[0];
      
      let instanceResponse;
      try {
        instanceResponse = await evolutionClient.createInstance(instanceName);
        console.log('[Evolution Init] Instance created successfully');
      } catch (error: any) {
        if (error.message?.includes('already exists') || error.response?.data?.message?.includes('already exists')) {
          console.log('[Evolution Init] Instance already exists in Evolution API');
          instanceResponse = await evolutionClient.connectInstance(instanceName);
        } else {
          throw error;
        }
      }
      
      const qrCode = instanceResponse.instance?.qrcode?.base64;
      const connectionStatus = instanceResponse.instance?.status || 'disconnected';
      
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
      const protocol = domain.includes('localhost') ? 'http' : 'https';
      const webhookUrl = `${protocol}://${domain}/api/channels/evolution/webhook/${instanceName}`;
      
      console.log('[Evolution Init] Configuring webhook:', webhookUrl);
      
      let webhookConfigured = false;
      let webhookEvents: string[] = [];
      
      try {
        const webhookResponse = await evolutionClient.setWebhook(instanceName, webhookUrl);
        webhookConfigured = true;
        webhookEvents = webhookResponse.webhook?.events || [];
        console.log('[Evolution Init] Webhook configured successfully');
      } catch (error: any) {
        console.warn('[Evolution Init] Webhook configuration failed:', error.message);
        console.warn('[Evolution Init] Continuing without webhook - messages will not be received automatically');
      }
      
      const channel = await storage.createChannel({
        name: `WhatsApp - ${instanceName}`,
        type: 'whatsapp',
        isActive: false,
        apiUrl,
        apiKey,
        instanceId: instanceName,
        webhookUrl,
        config: {
          qrCode,
          connectionStatus,
          phoneNumber: instanceNumber,
          webhookConfigured,
          webhookEvents,
          autoCreated: true,
        },
        createdBy: adminUser.id,
      } as any);
      
      console.log('[Evolution Init] Channel created successfully:', channel.id);
      console.log('[Evolution Init] QR Code available:', !!qrCode);
      
      if (qrCode) {
        console.log('[Evolution Init] Scan the QR code in the Channels Settings page to connect');
      }
    }
    
    console.log('[Evolution Init] Synchronizing messages and contacts...');
    await syncMessagesAndContacts(storage, evolutionClient, instanceName);
    
    console.log('[Evolution Init] Initialization completed successfully');
  } catch (error: any) {
    console.error('[Evolution Init] Failed to initialize:', error.message);
    throw error;
  }
}

async function syncMessagesAndContacts(
  storage: IStorage,
  evolutionClient: EvolutionAPIClient,
  instanceName: string
): Promise<void> {
  try {
    const chats = await evolutionClient.fetchChats(instanceName);
    console.log(`[Evolution Sync] Found ${chats.length} chats to sync`);
    
    for (const chat of chats.slice(0, 10)) {
      const phoneNumber = chat.id.replace('@s.whatsapp.net', '').replace('@c.us', '');
      
      let client = await storage.getUserByEmail(`${phoneNumber}@whatsapp`);
      
      if (!client) {
        const { hashPassword } = await import('./auth');
        const crypto = await import('crypto');
        // Create WhatsApp contact with random secure password (they cannot login anyway)
        client = await storage.createUser({
          email: `${phoneNumber}@whatsapp`,
          password: await hashPassword(crypto.randomBytes(32).toString('hex')),
          firstName: chat.name || phoneNumber,
          lastName: '',
          role: 'client',
          sidebarCollapsed: 'false',
          isWhatsAppContact: true,
          phoneNumber: phoneNumber,
          profileImageUrl: null,
          resetToken: null,
          resetTokenExpiry: null,
        });
        console.log(`[Evolution Sync] Created contact: ${phoneNumber}`);
      }
    }
    
    console.log('[Evolution Sync] Contacts synchronized');
  } catch (error: any) {
    console.error('[Evolution Sync] Sync failed:', error.message);
  }
}

