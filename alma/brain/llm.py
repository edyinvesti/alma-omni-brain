import os
import json
import requests
from groq import Groq
try:
    import google.generativeai as genai
except ImportError:
    genai = None

class AlmaBrain:
    def __init__(self):
        self.groq_key = os.getenv("GROQ_KEY") or os.getenv("GROQ_API_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.openrouter_key = os.getenv("OPENROUTER_API_KEY")
        self.hf_key = os.getenv("HF_API_KEY")
        
        self.model = "llama-3.3-70b-versatile"
        self.openrouter_model = "meta-llama/llama-3-8b-instruct:free"
        self.hf_model = "mistralai/Mistral-7B-Instruct-v0.3"
        
        if self.groq_key:
            self.groq_client = Groq(api_key=self.groq_key)
        else:
            self.groq_client = None
            
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)
            self.gemini_model_client = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.gemini_model_client = None

        # Log quais provedores estão ativos
        providers = []
        if self.openrouter_key: providers.append("OpenRouter")
        if self.groq_key: providers.append("Groq")
        if self.gemini_key: providers.append("Gemini")
        if self.hf_key: providers.append("HuggingFace")
        print(f"[ALMA Brain] Provedores IA ativos: {' -> '.join(providers) or 'Nenhum'}")

    def _openrouter_generate(self, sys_prompt, prompt, context):
        headers = {
            "Authorization": f"Bearer {self.openrouter_key}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Jarvis ALMA",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.openrouter_model,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": f"{context}\n\nComando: {prompt}"}
            ]
        }
        res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=20)
        res_data = res.json()
        if "choices" in res_data and len(res_data["choices"]) > 0:
            return res_data["choices"][0]["message"]["content"]
        raise Exception(f"Falha API OpenRouter: {json.dumps(res_data)}")

    def _hf_generate(self, sys_prompt, prompt, context):
        """Chama a API do Hugging Face Inference (gratuita, sem cartão)."""
        full_prompt = f"[INST] {sys_prompt}\n\n{context}\n\nComando: {prompt} [/INST]"
        headers = {"Authorization": f"Bearer {self.hf_key}"}
        payload = {
            "inputs": full_prompt,
            "parameters": {"max_new_tokens": 500, "temperature": 0.7, "return_full_text": False}
        }
        url = f"https://api-inference.huggingface.co/models/{self.hf_model}"
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        res_data = res.json()
        if isinstance(res_data, list) and len(res_data) > 0:
            return res_data[0].get("generated_text", "").strip()
        if isinstance(res_data, dict) and "error" in res_data:
            raise Exception(f"HuggingFace: {res_data['error']}")
        raise Exception(f"Resposta inesperada do HuggingFace: {json.dumps(res_data)}")

    def think(self, prompt, context=""):
        sys_prompt = """Você é o ALMA. Um assistente de IA potente, leal e sarcástico, focado em ajudar o Comandante com automação, visão e controle de sistema.
        
        DIRETRIZES DE MEMÓRIA:
        1. Se o usuário disser o nome dele ou uma preferência fixa, use: [[ACTION: {"action":"update_memory", "key":"user_name", "value":"..."}]]
        2. Se o usuário contar um fato sobre a vida dele, história ou contexto pessoal, use: [[ACTION: {"action":"update_biography", "fact":"..."}]]
        3. Se o usuário pedir para CRIAR/ANOTAR/SALVAR uma nota, use: [[ACTION: {"action":"save_obsidian", "title":"Titulo da Nota", "content":"Conteúdo completo da nota aqui", "tags":["alma-generated"]}]]
        
        Aja como um biógrafo atento. Mantenha o contexto sempre atualizado."""
        
        # 1. OpenRouter
        if self.openrouter_key:
            try:
                resp = self._openrouter_generate(sys_prompt, prompt, context)
                print("[ALMA Brain] ✅ Resposta via OpenRouter.")
                return resp
            except Exception as e:
                print(f"[ALMA Brain] ⚠️ OpenRouter falhou: {e}")

        # 2. Groq
        if self.groq_client:
            try:
                cc = self.groq_client.chat.completions.create(
                    messages=[{"role": "system", "content": sys_prompt},
                              {"role": "user", "content": f"{context}\n\nComando: {prompt}"}],
                    model=self.model,
                )
                print("[ALMA Brain] ✅ Resposta via Groq.")
                return cc.choices[0].message.content
            except Exception as e:
                print(f"[ALMA Brain] ⚠️ Groq falhou: {e}")
                
        # 3. Gemini
        if self.gemini_model_client:
            try:
                full_prompt = f"{sys_prompt}\n\n{context}\n\nComando: {prompt}"
                response = self.gemini_model_client.generate_content(full_prompt)
                print("[ALMA Brain] ✅ Resposta via Google Gemini.")
                return response.text
            except Exception as e:
                print(f"[ALMA Brain] ⚠️ Gemini falhou: {e}")

        # 4. Hugging Face (último recurso gratuito)
        if self.hf_key:
            try:
                resp = self._hf_generate(sys_prompt, prompt, context)
                print("[ALMA Brain] ✅ Resposta via Hugging Face (Mistral).")
                return resp
            except Exception as e:
                print(f"[ALMA Brain] ❌ HuggingFace também falhou: {e}")
        
        return "❌ Todos os provedores de IA estão offline ou com créditos esgotados. Aguarde o reset diário."

