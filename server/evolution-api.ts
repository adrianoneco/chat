import axios, { AxiosInstance } from 'axios';

export interface EvolutionAPIConfig {
  apiUrl: string;
  apiKey: string;
}

export interface CreateInstanceResponse {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
    qrcode?: {
      code: string;
      base64: string;
    };
  };
}

export interface InstanceStatus {
  instance: {
    instanceName: string;
    owner: string;
    profileName?: string;
    profilePictureUrl?: string;
    profileStatus?: string;
    state?: string;
    status?: string;
  };
}

export interface WebhookResponse {
  webhook: {
    url: string;
    webhookByEvents: boolean;
    webhookBase64: boolean;
    events: string[];
  };
}

export class EvolutionAPIClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: EvolutionAPIConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      timeout: 30000,
    });
  }

  async createInstance(instanceName: string): Promise<CreateInstanceResponse> {
    try {
      const response = await this.client.post('/instance/create', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });
      return response.data;
    } catch (error: any) {
      console.error('[EvolutionAPI] Error creating instance:', error.response?.data || error.message);
      throw new Error(`Erro ao criar instância no EvolutionAPI: ${error.response?.data?.message || error.message}`);
    }
  }

  async setWebhook(instanceName: string, webhookUrl: string): Promise<WebhookResponse> {
    try {
      const response = await this.client.post(`/webhook/set/${instanceName}`, {
        url: webhookUrl,
        webhookByEvents: true,
        webhookBase64: false,
        events: [
          'CONTACTS_SET',
          'CONTACTS_UPDATE',
          'CONTACTS_UPSERT',
          'MESSAGES_DELETE',
          'MESSAGES_UPDATE',
          'MESSAGES_UPSERT',
          'PRESENCE_UPDATE',
          'SEND_MESSAGE',
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
        ],
      });
      return response.data;
    } catch (error: any) {
      console.error('[EvolutionAPI] Error setting webhook:', error.response?.data || error.message);
      throw new Error(`Erro ao configurar webhook: ${error.response?.data?.message || error.message}`);
    }
  }

  async getInstanceStatus(instanceName: string): Promise<InstanceStatus> {
    try {
      const response = await this.client.get(`/instance/fetchInstances/${instanceName}`);
      return response.data;
    } catch (error: any) {
      console.error('[EvolutionAPI] Error fetching instance status:', error.response?.data || error.message);
      throw new Error(`Erro ao buscar status da instância: ${error.response?.data?.message || error.message}`);
    }
  }

  async connectInstance(instanceName: string): Promise<any> {
    try {
      const response = await this.client.get(`/instance/connect/${instanceName}`);
      return response.data;
    } catch (error: any) {
      console.error('[EvolutionAPI] Error connecting instance:', error.response?.data || error.message);
      throw new Error(`Erro ao conectar instância: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteInstance(instanceName: string): Promise<void> {
    try {
      await this.client.delete(`/instance/delete/${instanceName}`);
    } catch (error: any) {
      console.error('[EvolutionAPI] Error deleting instance:', error.response?.data || error.message);
      throw new Error(`Erro ao deletar instância: ${error.response?.data?.message || error.message}`);
    }
  }

  async logoutInstance(instanceName: string): Promise<void> {
    try {
      await this.client.delete(`/instance/logout/${instanceName}`);
    } catch (error: any) {
      console.error('[EvolutionAPI] Error logging out instance:', error.response?.data || error.message);
      throw new Error(`Erro ao desconectar instância: ${error.response?.data?.message || error.message}`);
    }
  }

  async fetchChats(instanceName: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/chat/fetchChats/${instanceName}`);
      return response.data || [];
    } catch (error: any) {
      console.error('[EvolutionAPI] Error fetching chats:', error.response?.data || error.message);
      return [];
    }
  }

  async fetchMessages(instanceName: string, chatId: string, limit: number = 50): Promise<any[]> {
    try {
      const response = await this.client.post(`/chat/findMessages/${instanceName}`, {
        where: {
          key: {
            remoteJid: chatId,
          },
        },
        limit,
      });
      return response.data?.messages || [];
    } catch (error: any) {
      console.error('[EvolutionAPI] Error fetching messages:', error.response?.data || error.message);
      return [];
    }
  }
}
