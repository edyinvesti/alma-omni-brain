import json
import os
from datetime import datetime

class JarvisMemory:
    def __init__(self, project_name="global"):
        self.project_path = f"jarvis/projects/{project_name}"
        os.makedirs(self.project_path, exist_ok=True)
        os.makedirs(f"{self.project_path}/files", exist_ok=True)
        
        self.memory_file = f"{self.project_path}/memory.json"
        self.history_file = f"{self.project_path}/chat_history.txt"
        
        self.data = self._load_memory()

    def _load_memory(self):
        if os.path.exists(self.memory_file):
            with open(self.memory_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"user_name": "Comandante", "preferences": {}, "last_interaction": ""}

    def save_memory(self, key, value):
        self.data[key] = value
        with open(self.memory_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, indent=4, ensure_ascii=False)

    def add_history(self, role, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(self.history_file, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] {role}: {message}\n")

    def get_context(self):
        # Retorna o contexto básico para o cérebro
        return f"Memória atual: {json.dumps(self.data)}"
