interface RedisConfig {
  url: string;
}

interface OpenAIConfig {
  baseURL: string;
  org: string;
  key: string;
}

interface ChatConfig {
  bot_name: string;
  system_prompt: string;
  reply_on_error: string;
  memory_duration: number;
  queue_max_token: number;
}

interface Config {
  redis: RedisConfig;
  openai: OpenAIConfig;
  chat: ChatConfig;
}
