import json
import os

class AlmaMemory:
    def __init__(self, project_name="MasterProject"):
        self.project_name = project_name
        self.memory_file = os.path.join(os.path.dirname(__file__), "memory_data.json")
        self.data = self._load()
        if "user_name" not in self.data:
            self.data["user_name"] = "Comandante"
            self.data["history"] = []
            self.data["biography"] = []
            self._save()
            
    def _load(self):
        if os.path.exists(self.memory_file):
            try:
                with open(self.memory_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}
        
    def _save(self):
        with open(self.memory_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, indent=4)
            
    def get_context(self):
        history = self.data.get("history", [])
        bio = self.data.get("biography", [])
        
        ctx = "CONTEXTO HISTÓRICO:\n"
        for h in history[-10:]:
            ctx += f"{h['role']}: {h['text']}\n"
            
        if bio:
            ctx += "\nFATOS BIOGRÁFICOS IMPORTANTES:\n"
            for b in bio:
                ctx += f"- {b}\n"
        return ctx
        
    def add_history(self, role, text):
        if "history" not in self.data:
            self.data["history"] = []
        self.data["history"].append({"role": role, "text": text})
        
        # Limitar o histórico para n crescer infinito
        if len(self.data["history"]) > 50:
            self.data["history"] = self.data["history"][-50:]
            
        self._save()
        
    def save_memory(self, key, value):
        self.data[key] = value
        self._save()
        
    def update_biography(self, fact):
        if "biography" not in self.data:
            self.data["biography"] = []
        if fact not in self.data["biography"]:
            self.data["biography"].append(fact)
            self._save()
