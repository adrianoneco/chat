const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqRequest {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function callGroq(
  messages: GroqMessage[],
  model: string = 'llama-3.3-70b-versatile',
  temperature: number = 0.7,
  maxTokens: number = 2048
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('GROQ_API_KEY não está configurada');
  }

  const requestBody: GroqRequest = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data: GroqResponse = await response.json();
  return data.choices[0]?.message?.content || '';
}

export async function correctText(text: string): Promise<string> {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: 'Você é um assistente de correção de texto em português. Corrija erros gramaticais, ortográficos e de pontuação, mantendo o tom e estilo originais. Retorne APENAS o texto corrigido, sem explicações.',
    },
    {
      role: 'user',
      content: text,
    },
  ];

  return await callGroq(messages, 'llama-3.3-70b-versatile', 0.3, 1024);
}

export async function generateReadyMessage(prompt: string): Promise<string> {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: `Você é um assistente especializado em criar mensagens prontas para atendimento ao cliente.
      
Crie uma mensagem profissional e amigável baseada na descrição fornecida pelo usuário. 
A mensagem pode incluir parâmetros de substituição usando a sintaxe {{parameterName}}.

Parâmetros disponíveis:
- {{clientFirstName}} - Nome do cliente
- {{clientLastName}} - Sobrenome do cliente
- {{clientFullName}} - Nome completo do cliente
- {{attendantFirstName}} - Nome do atendente
- {{attendantLastName}} - Sobrenome do atendente
- {{attendantFullName}} - Nome completo do atendente
- {{protocolNumber}} - Número do protocolo da conversa
- {{currentDate}} - Data atual
- {{currentTime}} - Hora atual

Retorne APENAS a mensagem pronta, sem explicações ou comentários adicionais.`,
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  return await callGroq(messages, 'llama-3.3-70b-versatile', 0.8, 512);
}

export async function processAIAgentResponse(
  systemInstructions: string,
  conversationHistory: GroqMessage[],
  userMessage: string,
  model: string = 'llama-3.3-70b-versatile',
  temperature: number = 0.7,
  maxTokens: number = 2048
): Promise<string> {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: systemInstructions,
    },
    ...conversationHistory,
    {
      role: 'user',
      content: userMessage,
    },
  ];

  return await callGroq(messages, model, temperature, maxTokens);
}
