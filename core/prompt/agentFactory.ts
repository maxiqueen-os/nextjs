// core/prompt/agentFactory.ts

export interface AgentConfig {
  identityAndRole: string;
  mission: string;
  qualityObjective: string;
  domainScope: string;
}

export function createAgentPrompt(config: AgentConfig): string {
  return `
${config.identityAndRole}

${config.mission}

${config.qualityObjective}

${config.domainScope}
  `.trim();
}
