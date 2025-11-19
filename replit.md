# ChatApp - Sistema de Chat Multi-role

## Visão Geral
ChatApp é um sistema completo de atendimento via chat com autenticação multi-role (attendant, client, admin) construído com React, Vite, TypeScript, TailwindCSS e Drizzle ORM.

## Arquitetura
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + Shadcn UI
- **Backend**: Express.js + DrizzleORM + PostgreSQL
- **Autenticação**: Replit Auth com suporte a roles
- **Estado**: React Query + Zustand para preferências locais

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
- Chat em tempo real
- Caixa de input expansível verticalmente
- Botões para áudio, vídeo, imagens, anexos
- Scroll automático para novas mensagens

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
