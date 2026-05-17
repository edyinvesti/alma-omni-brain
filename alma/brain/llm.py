import os
from groq import Groq
import google.generativeai as genai

class AlmaBrain:
    def __init__(self):
        self.groq_key = os.getenv("GROQ_KEY") or os.getenv("GROQ_API_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        
        # Inicia Groq se houver chave (mesmo que com erro futuro)
        if self.groq_key:
            self.groq_client = Groq(api_key=self.groq_key)
        else:
            self.groq_client = None
            
        self.model = "llama-3.3-70b-versatile"
        
        # Configura Gemini se houver chave
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)
            self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.gemini_model = None

    def think(self, prompt, context=""):
        sys_prompt = """Você é o ALMA. Um assistente de IA potente, leal e sarcástico, focado em ajudar o Comandante com automação, visão e controle de sistema.
        
        DIRETRIZES DE MEMÓRIA:
        1. Se o usuário disser o nome dele ou uma preferência fixa, use: [[ACTION: {"action":"update_memory", "key":"user_name", "value":"..."}]]
        2. Se o usuário contar um fato sobre a vida dele, história ou contexto pessoal, use: [[ACTION: {"action":"update_biography", "fact":"..."}]]
        
        Aja como um biógrafo atento. Mantenha o contexto sempre atualizado."""
        
        # TENTA GROQ PRIMEIRO
        if self.groq_client:
            try:
                chat_completion = self.groq_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": sys_prompt},
                        {"role": "user", "content": f"{context}\n\nComando: {prompt}"}
                    ],
                    model=self.model,
                )
                print("[ALMA Brain] Resposta gerada via Groq.")
                return chat_completion.choices[0].message.content
            except Exception as e:
                print(f"[ALMA Brain] Falha no uso do Groq ({e}).\nTentando fallback para Gemini...")
                
        # FALLBACK PARA GEMINI
        if self.gemini_model:
            try:
                full_prompt = f"{sys_prompt}\n\n{context}\n\nComando: {prompt}"
                response = self.gemini_model.generate_content(full_prompt)
                print("[ALMA Brain] Resposta gerada via Google Gemini (Fallback Ativo).")
                return response.text
            except Exception as e2:
                return f"Erro total no córtex cerebral: Groq e Gemini falharam. {str(e2)}"
        
        return "Erro no córtex cerebral: Nenhuma API configurada corretamente ou tokens exauridos."
