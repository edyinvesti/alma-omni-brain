---
title: Arquitetura do Sistema ALMA
date: 2026-05-17 22:15
tags:
  - alma-generated
  - sistema
  - arquitetura
  - documentacao
---

# 🧠 Sistema ALMA — Documentação de Arquitetura

## Visão Geral
O ALMA (Autonomous Life Management Assistant) é um sistema de IA local e em nuvem que combina um backend Node.js, um núcleo Python de inteligência, automação de PC e integração com Telegram.

---

## 📁 Estrutura de Pastas

```
jarvis.html/
├── alma/                    # Núcleo Python
│   ├── brain/
│   │   └── llm.py           # Cérebro IA (OpenRouter → Groq → Gemini → HuggingFace)
│   ├── memory/
│   │   ├── memory_manager.py    # Memória persistente (JSON)
│   │   └── obsidian_manager.py  # Integração com este Cofre Obsidian
│   ├── automation/
│   │   ├── pc_controller.py     # Controle do Windows (pyautogui)
│   │   └── hermes_server.py     # Servidor Flask local (porta 3001)
│   ├── voice/
│   │   ├── speaker.py           # Voz (TTS)
│   │   └── listener.py          # Reconhecimento de voz
│   ├── vision/
│   │   └── detector.py          # Visão computacional (câmera)
│   └── main.py              # Ponto de entrada do Python
├── src/
│   ├── server.js            # Backend principal Node.js (porta 3000)
│   ├── database.js          # Conexão Turso/LibSQL
│   ├── action_queue.js      # Fila de ações segura
│   └── action_parser.js     # Parser de [[ACTION]] tags
├── bin/
│   ├── indexer.js           # Indexador RAG de documentos
│   └── db_init_rag.js       # Init do banco vetorial
├── alma_daemon.js           # Gerenciador de processos (orquestra tudo)
└── .env                     # Configurações e chaves de API
```

---

## 🤖 Provedores de IA (Fallback em Cascata)

| Prioridade | Provedor | Modelo | Custo |
|---|---|---|---|
| 1º | OpenRouter | openrouter/auto | Gratuito (limite diário) |
| 2º | Groq | llama-3.3-70b-versatile | Gratuito (limite diário) |
| 3º | Google Gemini | gemini-1.5-flash | Gratuito (limite diário) |
| 4º | Hugging Face | Mistral-7B-Instruct | Gratuito (sem limite fixo) |

---

## 🔌 Portas e Serviços

| Serviço | Porta | Protocolo |
|---|---|---|
| Alma Node.js Core | 3000 | HTTP + WebSocket |
| Hermes Flask (Python) | 3001 | HTTP |
| Telegram Bot | — | Polling Local |

---

## 🗄️ Banco de Dados

- **Turso/LibSQL** (Nuvem): `alma-edyinvesti.aws-us-west-2.turso.io`
- Tabelas: `logs`, `memory`, `history`
- Memória local Python: `alma/memory/memory_data.json`

---

## 🔐 Variáveis de Ambiente (.env)

| Variável | Descrição |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token do bot Telegram |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat ID do administrador |
| `OPENROUTER_API_KEY` | Chave OpenRouter |
| `GEMINI_API_KEY` | Chave Google Gemini |
| `HF_API_KEY` | Chave Hugging Face |
| `TURSO_DATABASE_URL` | URL do banco LibSQL |
| `TURSO_AUTH_TOKEN` | Token de autenticação Turso |
| `API_SECRET` | Chave interna de segurança |
| `OBSIDIAN_VAULT_PATH` | Caminho do Cofre Obsidian |
| `HERMES_URL` | URL do servidor Flask local |
| `HERMES_API_KEY` | Chave do servidor Hermes |

---

## 🛡️ Segurança Implementada

- ✅ Sanitização de comandos Shell (Command Injection bloqueado)
- ✅ Middleware de autenticação (`x-alma-key` header)
- ✅ Rate limiting por IP (30 req/min)
- ✅ Validação de caminhos de arquivo (Path Traversal bloqueado)
- ✅ RCE bloqueado no `action_queue.js`
- ✅ Content Security Policy nos headers HTTP

---

## 📝 Como Iniciar o Sistema

```bash
# Na pasta do projeto
npm start
```

O `alma_daemon.js` orquestra automaticamente:
1. Servidor Node.js (porta 3000)
2. Hermes Flask Python (porta 3001)
3. ALMA Core Python (main.py)

---

## 🔗 Integrações Ativas

- **Telegram** — Controle remoto via chat
- **Obsidian** — Segunda memória (este cofre)
- **Turso LibSQL** — Persistência em nuvem
- **WebSockets** — Dashboard em tempo real
