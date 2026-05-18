---
title: Roadmap ALMA — Funcionalidades Futuras
date: 2026-05-17 22:18
tags:
  - alma-generated
  - roadmap
  - planejamento
---

# 🗺️ Roadmap do Projeto ALMA

## ✅ Concluído (Maio 2026)

- [x] Backend Node.js com API REST e WebSockets
- [x] Bot Telegram com controle remoto (C2)
- [x] Núcleo Python (ALMA Core) com voz e visão
- [x] Sistema de Memória persistente (JSON + Turso)
- [x] Fallback de IA em 4 camadas (OpenRouter → Groq → Gemini → HuggingFace)
- [x] Integração com Obsidian (escrita de notas)
- [x] Segurança: bloqueio de Command Injection e RCE
- [x] Autenticação via `x-alma-key` e rate limiting
- [x] Screenshot e envio automático para Telegram

---

## 🔄 Em Progresso

- [ ] RAG — Leitura e busca nas notas do Obsidian
- [ ] Reconexão automática do bot (Hermes Adapter)
- [ ] Gerenciamento de memória no Node.js (evitar zombie processes)

---

## 🚀 Próximas Funcionalidades

### 🧠 Inteligência
- [ ] Modo "Deep Research" — Athena pesquisa e gera relatório completo
- [ ] Memória de longo prazo com embeddings vetoriais
- [ ] Aprendizado por feedback (Comandante aprova/rejeita respostas)
- [ ] Histórico de conversas com busca semântica

### 🤖 Automação
- [ ] Agendador de tarefas persistente (não em memória)
- [ ] Automação de postagens em redes sociais
- [ ] Monitoramento de preços e alertas personalizados
- [ ] Integração com Google Calendar

### 🔐 Segurança
- [ ] Sandbox para execução de automações Python
- [ ] Monitoramento de uso e alertas de billing automático
- [ ] Rotação automática de chaves de API

### 📱 Interface
- [ ] Dashboard responsivo para mobile
- [ ] App Android/iOS (PWA)
- [ ] Modo offline com IA local (Ollama opcional)

---

## 💡 Ideias Futuras

- Integração com WhatsApp Business API
- Monitoramento de leads e CRM básico
- ALMA como agente autônomo que age sem precisar de comandos
