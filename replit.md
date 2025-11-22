# ChatApp - Sistema de Chat Multi-role

## Visão Geral
ChatApp é um sistema completo de atendimento via chat com autenticação multi-role (attendant, client, admin) construído com React, Vite, TypeScript, TailwindCSS e Drizzle ORM.

## Histórico de Mudanças
- **22/11/2024**: Removida completamente a integração com EvolutionAPI e WhatsApp. Todas as funcionalidades de canais externos foram removidas. O sistema agora opera exclusivamente com conversas web e telegram nativas.

## Arquitetura
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + Shadcn UI
- **Backend**: Express.js + DrizzleORM + PostgreSQL
- **Autenticação**: Session-based com suporte a roles (attendant, client, admin)
- **Estado**: React Query para cache de dados

## Funcionalidades Principais

### Autenticação e Usuários
- Sistema de login via Replit Auth
- Roles: attendant (atendente), client (cliente), admin
- Gerenciamento de preferências de usuário (sidebar colapsada/expandida)

### Interface
- **Header**: Full-width com gradiente azul-roxo vertical e efeito glassmorphism
- **Sidebar Esquerda**: Colapsável com botão central, salva estado no PostgreSQL
- **Sidebar Direita**: Colapsável (inicia colapsada), mostra detalhes da conversa
- **Área Principal**: Lista de conversas com tabs de status e chat ativo

### Conversas
- Status: Pendente, Atendendo, Fechada
- Busca e filtros de conversas
- Protocolo único por conversa
- Histórico de conversas anteriores
- Geolocalização do cliente

### Mensagens
- Chat em tempo real via WebSocket
- Caixa de input expansível verticalmente
- Botões para áudio, vídeo, imagens, anexos
- Scroll automático para novas mensagens
- **Indicadores de atividade**: Mostra quando o outro usuário está digitando, gravando ou enviando arquivos
  - Status exibido em tempo real no cabeçalho da conversa
  - Validação de segurança no backend (verifica participantes)
  - Usa conexão WebSocket compartilhada para performance
  - Limpeza automática de status ao desmontar componente

## Estrutura de Dados

### Users
- id, email, firstName, lastName, profileImageUrl
- role: 'attendant' | 'client' | 'admin'
- sidebarCollapsed (preferência)

### Conversations
- id, protocolNumber, status, clientId, attendantId
- createdAt, updatedAt, closedAt
- clientLocation (geolocalização)

### Messages
- id, conversationId, senderId, content, type
- createdAt

## Design System
- Cores primárias: Azul (#3b82f6) to Roxo (#a855f7) gradient
- Fonte: Inter (padrão do sistema)
- Efeito glassmorphism: backdrop-blur com transparência
- Espaçamento: sistema consistente (4, 8, 12, 16, 20px)
- Todos os textos em português brasileiro

## Armazenamento
- Arquivos salvos localmente em `./data` com pastas separadas:
  - `./data/images` - Imagens de mensagens
  - `./data/audio` - Áudios de mensagens
  - `./data/video` - Vídeos de mensagens
  - `./data/files` - Outros arquivos
  - `./data/profiles` - Fotos de perfil

## Recursos Implementados
- WebSocket para chat em tempo real
- Upload de áudio/vídeo/imagens
- Sessões com express-session e MemoryStore
- Sistema de tags para conversas
- Mensagens prontas (ready messages)
- Webhooks para eventos do sistema
- Campanhas de envio
- Agentes de IA

## Integrações Removidas
- EvolutionAPI (WhatsApp) - removida em 22/11/2024
  - Tabela channels deletada
  - Campo isWhatsAppContact removido dos usuários
  - Todas as rotas e lógica de integração removidas
