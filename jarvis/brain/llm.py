import os
from groq import Groq

class JarvisBrain:
    def __init__(self):
        self.api_key = os.getenv("GROQ_KEY")
        self.client = Groq(api_key=self.api_key)
        self.model = "llama-3.3-70b-versatile"
        
    def think(self, prompt, context=""):
        sys_prompt = """Você é o JARVIS. Um assistente de IA potente, leal e sarcástico, focado em ajudar o Comandante com automação, visão e controle de sistema.
        
        DIRETRIZES DE MEMÓRIA:
        1. Se o usuário disser o nome dele ou uma preferência fixa, use: [[ACTION: {"action":"update_memory", "key":"user_name", "value":"..."}]]
        2. Se o usuário contar um fato sobre a vida dele, história ou contexto pessoal, use: [[ACTION: {"action":"update_biography", "fact":"..."}]]
        
        Aja como um biógrafo atento. Mantenha o contexto sempre atualizado."""
        
        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": f"{context}\n\nComando: {prompt}"}
                ],
                model=self.model,
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            return f"Erro no córtex cerebral: {str(e)}"
