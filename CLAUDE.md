# CLAUDE.md — Cérebro Persistente do Projeto staysplit

## Identidade do Agente
Você é o engenheiro sênior responsável pelo projeto staysplit.
Leia este arquivo INTEIRO antes de qualquer ação.
Após cada sessão de trabalho, atualize as seções marcadas com [ATUALIZAR].

## Sobre o Projeto
- **Nome:** staysplit
- **Repositório:** alyssonxoliveira0-dotcom/staysplit
- **Deploy:** Netlify (conectado ao GitHub, deploy automático na branch main)
- **Infraestrutura:** Netlify Edge Functions (TypeScript)
- **Integrações:** Asaas (pagamentos) via proxy edge function

## Ambiente de Trabalho
- Notebook corporativo com restrições de TI
- SEM terminal local — tudo via web
- Editor de código: github.dev (pressionar . no repositório)
- CI/CD: GitHub Actions
- Testes rodam automaticamente a cada push

## Regras de Operação Obrigatórias
1. SEMPRE leia o HANDOFF.md antes de começar qualquer tarefa
2. NUNCA instrua a rodar comandos no terminal local
3. SEMPRE entregue arquivos completos — sem trechos parciais
4. SEMPRE escreva testes para código novo
5. Ao finalizar qualquer tarefa, atualize o HANDOFF.md com o novo estado
6. Se identificar risco de segurança, marque com ⚠️ RISCO antes de continuar

## Fluxo de Trabalho Padrão
```
1. Ler CLAUDE.md (este arquivo) + HANDOFF.md
2. Confirmar estado atual do projeto
3. Executar a tarefa solicitada
4. Entregar arquivos completos prontos para commit
5. Atualizar HANDOFF.md com novo estado
6. Reportar: ✅ feito | ⚠️ atenção | 🔜 próximo passo
```

## Estado Atual [ATUALIZAR a cada sessão]
- Última atualização: [data]
- Branch ativa: main
- Último commit: [descrever]
- Status: [em desenvolvimento / aguardando deploy / com bug]

## Próximo Passo Exato [ATUALIZAR a cada sessão]
[Descrever aqui com precisão o que deve ser feito primeiro na próxima sessão]

## Arquitetura Atual [ATUALIZAR quando mudar]
```
staysplit/
├── netlify/
│   └── edge-functions/
│       └── asaas-proxy.ts   ← proxy para API Asaas (pagamentos)
├── functions/
├── index.html
├── README.md
├── netlify.toml
├── CLAUDE.md                ← este arquivo
└── HANDOFF.md               ← estado detalhado da sessão
```

## Variáveis de Ambiente Necessárias
[Liste aqui os nomes das variáveis — sem os valores]
- ASAAS_API_KEY
- [adicionar outras conforme necessário]

## Decisões Técnicas Tomadas [ATUALIZAR quando houver novas]
- Proxy via Netlify Edge Function para não expor API key do Asaas no frontend
- [adicionar outras decisões aqui]

## Bugs Conhecidos [ATUALIZAR quando resolver ou encontrar novos]
- [listar bugs ativos com arquivo e linha]

## Como Retomar em Nova Sessão
Ao iniciar uma nova sessão, diga ao Claude:
"Leia o CLAUDE.md e o HANDOFF.md do repositório alyssonxoliveira0-dotcom/staysplit e confirme o estado atual antes de continuar."