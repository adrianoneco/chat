import { db } from "./db";
import { users, conversations, messages } from "@shared/schema";

async function seed() {
  console.log("🌱 Iniciando seed do banco de dados...");

  try {
    // Criar usuários de teste
    const testUsers = await db.insert(users).values([
      {
        id: "user-client-1",
        email: "cliente1@exemplo.com",
        firstName: "João",
        lastName: "Silva",
        profileImageUrl: null,
        role: "client",
        sidebarCollapsed: "false",
      },
      {
        id: "user-client-2",
        email: "cliente2@exemplo.com",
        firstName: "Maria",
        lastName: "Santos",
        profileImageUrl: null,
        role: "client",
        sidebarCollapsed: "false",
      },
      {
        id: "user-attendant-1",
        email: "atendente1@exemplo.com",
        firstName: "Carlos",
        lastName: "Oliveira",
        profileImageUrl: null,
        role: "attendant",
        sidebarCollapsed: "false",
      },
      {
        id: "user-attendant-2",
        email: "atendente2@exemplo.com",
        firstName: "Ana",
        lastName: "Costa",
        profileImageUrl: null,
        role: "attendant",
        sidebarCollapsed: "false",
      },
      {
        id: "user-admin-1",
        email: "admin@exemplo.com",
        firstName: "Roberto",
        lastName: "Ferreira",
        profileImageUrl: null,
        role: "admin",
        sidebarCollapsed: "false",
      },
    ]).returning();

    console.log(`✅ Criados ${testUsers.length} usuários de teste`);

    // Criar conversas de teste
    const testConversations = await db.insert(conversations).values([
      {
        protocolNumber: "CHAT-2024-0001",
        status: "pending",
        clientId: "user-client-1",
        attendantId: null,
        clientLocation: "São Paulo, SP - Brasil",
        lastMessage: "Olá, preciso de ajuda com meu pedido",
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutos atrás
      },
      {
        protocolNumber: "CHAT-2024-0002",
        status: "attending",
        clientId: "user-client-2",
        attendantId: "user-attendant-1",
        clientLocation: "Rio de Janeiro, RJ - Brasil",
        lastMessage: "Obrigado pela ajuda!",
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 15), // 15 minutos atrás
      },
      {
        protocolNumber: "CHAT-2024-0003",
        status: "attending",
        clientId: "user-client-1",
        attendantId: "user-attendant-2",
        clientLocation: "São Paulo, SP - Brasil",
        lastMessage: "Entendi, vou aguardar",
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutos atrás
      },
      {
        protocolNumber: "CHAT-2024-0004",
        status: "closed",
        clientId: "user-client-2",
        attendantId: "user-attendant-1",
        clientLocation: "Rio de Janeiro, RJ - Brasil",
        lastMessage: "Problema resolvido, muito obrigado!",
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 horas atrás
        closedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
      {
        protocolNumber: "CHAT-2024-0005",
        status: "closed",
        clientId: "user-client-1",
        attendantId: "user-attendant-2",
        clientLocation: "São Paulo, SP - Brasil",
        lastMessage: "Tudo certo, agradeço a atenção",
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 dia atrás
        closedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      },
    ]).returning();

    console.log(`✅ Criadas ${testConversations.length} conversas de teste`);

    // Criar mensagens de teste para conversas ativas
    const conv1 = testConversations[0];
    const conv2 = testConversations[1];
    const conv3 = testConversations[2];

    const testMessages = [];

    // Mensagens para conversa 1 (pendente)
    testMessages.push(
      await db.insert(messages).values({
        conversationId: conv1.id,
        senderId: "user-client-1",
        content: "Olá, preciso de ajuda com meu pedido",
        type: "text",
        createdAt: new Date(Date.now() - 1000 * 60 * 5),
      }).returning()
    );

    // Mensagens para conversa 2 (em atendimento)
    testMessages.push(
      await db.insert(messages).values([
        {
          conversationId: conv2.id,
          senderId: "user-client-2",
          content: "Bom dia! Estou com uma dúvida sobre o produto que comprei",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 20),
        },
        {
          conversationId: conv2.id,
          senderId: "user-attendant-1",
          content: "Olá Maria! Como posso ajudá-la hoje?",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 19),
        },
        {
          conversationId: conv2.id,
          senderId: "user-client-2",
          content: "Gostaria de saber qual o prazo de entrega para São Paulo",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 18),
        },
        {
          conversationId: conv2.id,
          senderId: "user-attendant-1",
          content: "Para São Paulo, o prazo de entrega é de 3 a 5 dias úteis após a confirmação do pagamento",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 17),
        },
        {
          conversationId: conv2.id,
          senderId: "user-client-2",
          content: "Perfeito! E tem algum custo adicional?",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 16),
        },
        {
          conversationId: conv2.id,
          senderId: "user-attendant-1",
          content: "O frete é gratuito para compras acima de R$ 100,00",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 15),
        },
        {
          conversationId: conv2.id,
          senderId: "user-client-2",
          content: "Obrigado pela ajuda!",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 15),
        },
      ]).returning()
    );

    // Mensagens para conversa 3 (em atendimento)
    testMessages.push(
      await db.insert(messages).values([
        {
          conversationId: conv3.id,
          senderId: "user-client-1",
          content: "Boa tarde! Preciso alterar o endereço de entrega",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 35),
        },
        {
          conversationId: conv3.id,
          senderId: "user-attendant-2",
          content: "Olá João! Vou verificar isso para você",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 34),
        },
        {
          conversationId: conv3.id,
          senderId: "user-attendant-2",
          content: "Qual seria o novo endereço?",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 33),
        },
        {
          conversationId: conv3.id,
          senderId: "user-client-1",
          content: "Rua das Flores, 123 - Jardim Paulista, São Paulo - SP, CEP 01234-567",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 32),
        },
        {
          conversationId: conv3.id,
          senderId: "user-attendant-2",
          content: "Perfeito! Vou processar a alteração. Pode levar até 24 horas para atualizar no sistema",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 31),
        },
        {
          conversationId: conv3.id,
          senderId: "user-client-1",
          content: "Entendi, vou aguardar",
          type: "text",
          createdAt: new Date(Date.now() - 1000 * 60 * 30),
        },
      ]).returning()
    );

    console.log(`✅ Criadas mensagens de teste para ${testMessages.length} conversas`);

    console.log("✨ Seed concluído com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao executar seed:", error);
    throw error;
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
