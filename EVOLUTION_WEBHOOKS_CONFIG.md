# Configuração de Webhooks do Evolution API

## Resumo
O sistema está configurado para receber e processar automaticamente todos os eventos de webhook do Evolution API solicitados.

## Eventos Configurados

Ao criar uma nova instância do Evolution API, os seguintes webhooks são configurados automaticamente:

### 📧 Eventos de Contatos
- **CONTACTS_SET** - Sincronização em massa de contatos
- **CONTACTS_UPDATE** - Atualização de um contato existente
- **CONTACTS_UPSERT** - Criação ou atualização de contato (versão mais recente)

### 💬 Eventos de Mensagens
- **MESSAGES_DELETE** - Exclusão de mensagem
- **MESSAGES_UPDATE** - Atualização de mensagem
- **MESSAGES_UPSERT** - Nova mensagem recebida ou enviada

### 👤 Eventos de Presença
- **PRESENCE_UPDATE** - Atualização de status (online, digitando, offline)

### 📤 Eventos de Envio
- **SEND_MESSAGE** - Confirmação de envio de mensagem

### 🔧 Eventos de Sistema (Configurados automaticamente)
- **QRCODE_UPDATED** - Atualização do QR Code para conexão
- **CONNECTION_UPDATE** - Mudança no status da conexão

## Como Funciona

### 1. Criação da Instância
Quando uma nova instância é criada (em `server/evolution-init.ts`):
```typescript
const evolutionClient = new EvolutionAPIClient({ apiUrl, apiKey });
const instanceResponse = await evolutionClient.createInstance(instanceName);
```

### 2. Configuração Automática do Webhook
Logo após a criação, o webhook é configurado automaticamente:
```typescript
const webhookUrl = `${protocol}://${domain}/api/channels/evolution/webhook/${instanceName}`;
await evolutionClient.setWebhook(instanceName, webhookUrl);
```

### 3. Processamento de Eventos
O endpoint `/api/channels/evolution/webhook/:instanceId` processa todos os eventos recebidos:

#### Eventos de Contatos
- **CONTACTS_SET**: Processa sincronização em massa de contatos
  - Atualiza contatos existentes
  - Cria novos contatos automaticamente
  
- **CONTACTS_UPDATE**: Atualiza informações de um contato
  - Nome do contato
  - Foto de perfil
  
- **CONTACTS_UPSERT**: Cria ou atualiza contato
  - Verifica se o contato já existe
  - Cria novo se não existir
  - Atualiza informações se já existir
  - Dispara webhook `contact.created` para novos contatos

#### Eventos de Mensagens
- **MESSAGES_UPSERT**: Processa novas mensagens
  - Cria/atualiza contato automaticamente
  - Cria/localiza conversa ativa
  - Detecta tipo de mensagem (texto, imagem, áudio, vídeo, arquivo)
  - Faz download de mídias automaticamente
  - Salva mensagem no sistema
  - Dispara webhooks e notificações WebSocket
  
- **MESSAGES_UPDATE**: Registra atualizações de mensagens
- **MESSAGES_DELETE**: Registra exclusões de mensagens

#### Eventos de Presença
- **PRESENCE_UPDATE**: Atualiza status do usuário
  - Online/Offline
  - Digitando
  - Notifica via WebSocket em tempo real

#### Eventos de Envio
- **SEND_MESSAGE**: Confirma envio de mensagens

## Webhooks Internos Disparados

O sistema dispara os seguintes webhooks internos que podem ser configurados em "Configurações > Webhooks":

### Contatos
- `contact.created` - Quando um novo contato é criado
- `evolution.contacts.set` - Sincronização em massa
- `evolution.contacts.update` - Atualização de contato
- `evolution.contacts.upsert` - Criação/atualização de contato

### Mensagens
- `message.created` - Nova mensagem criada
- `message.received` - Mensagem recebida
- `evolution.message.update` - Mensagem atualizada
- `evolution.message.delete` - Mensagem excluída
- `evolution.message.sent` - Mensagem enviada

### Conversas
- `conversation.created` - Nova conversa criada

### Presença
- `evolution.presence.update` - Status de presença atualizado

### Sistema
- `evolution.qrcode.updated` - QR Code atualizado

## Notificações em Tempo Real

Além dos webhooks, o sistema envia notificações WebSocket em tempo real para:
- Novas mensagens
- Novas conversas
- Mudanças de status de presença

## Estrutura de Dados dos Contatos

Quando um contato é processado, os seguintes campos são utilizados:
```typescript
{
  id: string,                    // Ex: "5511999999999@s.whatsapp.net"
  name?: string,                 // Nome do contato
  notify?: string,               // Nome de notificação
  pushName?: string,             // Nome do push
  profilePictureUrl?: string     // URL da foto de perfil
}
```

O sistema prioriza os nomes na seguinte ordem:
1. `name`
2. `notify`
3. `pushName`
4. Número de telefone (fallback)

## Arquivos Modificados

- ✅ `server/evolution-api.ts` - Configuração dos eventos do webhook
- ✅ `server/routes.ts` - Handlers para processar todos os eventos
- ✅ `server/evolution-init.ts` - Inicialização automática com webhooks configurados

## Testando

Para testar os webhooks, você pode:

1. Conectar uma instância do WhatsApp
2. Enviar uma mensagem para o número conectado
3. Verificar os logs do servidor para confirmar o recebimento dos eventos
4. Configurar webhooks personalizados em "Configurações > Webhooks" para receber notificações

## Logs de Depuração

Todos os eventos recebidos são registrados no console:
```
[Evolution API] Received webhook event: CONTACTS_UPSERT for instance: chatapp
[Evolution API] Contact upserted (created): 5511999999999
[Evolution API] Received webhook event: MESSAGES_UPSERT for instance: chatapp
```

## Conclusão

✅ Todos os eventos solicitados estão configurados
✅ A configuração é feita automaticamente ao criar a instância
✅ Os contatos são sincronizados automaticamente
✅ As mensagens são processadas em tempo real
✅ Notificações WebSocket funcionam perfeitamente
✅ Sistema pronto para uso em produção
