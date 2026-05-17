import os
import time
import re
import json
import asyncio
import urllib.request
from dotenv import load_dotenv
from brain.llm import AlmaBrain
from voice.speaker import AlmaSpeaker
from voice.listener import AlmaListener
from automation.pc_controller import HermesAgent
from memory.memory_manager import AlmaMemory
from web_agent.agent import AthenaAgent
from vision.detector import AlmaVision

# Carrega variáveis de ambiente do .env
load_dotenv()

# Detecta se está em modo nuvem
IS_CLOUD = os.getenv("CLOUD_MODE", "false").lower() == "true"
NODE_SERVER = os.getenv("NODE_SERVER_URL", "http://localhost:3000")

# FIX 7: Ponte Python → Node.js
def bridge_ping(event, data=None):
    """Envia evento do Python para o servidor Node.js em tempo real."""
    try:
        payload = json.dumps({"event": event, "data": data or {}}).encode("utf-8")
        req = urllib.request.Request(
            f"{NODE_SERVER}/api/python-bridge",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass  # Silencioso se Node offline


class AlmaCore:
    def __init__(self):
        print(f"|| ALMA - SISTEMA DE INTELIGÊNCIA MASTER {'[CLOUD MODE]' if IS_CLOUD else '[LOCAL MODE]'} ||")
        self.memory = AlmaMemory("MasterProject")
        self.brain = AlmaBrain()
        
        if IS_CLOUD:
            print("[INFO] Rodando em modo nuvem. Módulos físicos (Voz/Visão/PC) desativados.")
            self.speaker = None
            self.listener = None
            self.automation = None
            self.vision = None
        else:
            self.speaker = AlmaSpeaker()
            self.listener = AlmaListener()
            self.automation = HermesAgent()
            try:
                self.vision = AlmaVision()
            except Exception as e:
                print(f"[AVISO] Módulo de visão inativo: {e}")
                self.vision = None
        
        self.web_agent = AthenaAgent()
        self.running = True

    def run(self):
        context = self.memory.get_context()
        welcome_msg = f"Bem-vindo de volta, {self.memory.data['user_name']}. Todos os sistemas {'online' if IS_CLOUD else 'operacionais'}."
        bridge_ping("PYTHON_ONLINE", {"mode": "cloud" if IS_CLOUD else "local"})
        
        if self.speaker:
            self.speaker.speak(welcome_msg)
        else:
            print(f"[ALMA] {welcome_msg}")
        
        while self.running:
            # 1. Entrada
            if IS_CLOUD:
                time.sleep(10) 
                continue 

            command = self.listener.listen()
            if not command: continue
            
            self.memory.add_history("Comandante", command)
            bridge_ping("COMANDO", {"texto": command})
            
            if "desativar" in command.lower():
                self.speaker.speak("Desativando sistemas centrais. Até logo, Comandante.")
                bridge_ping("PYTHON_OFFLINE", {})
                break
            
            # 2. Raciocínio (Cérebro)
            print("[ALMA] Consultando matriz neural...")
            response = self.brain.think(command, context=context)
            
            # 3. Execução de Ações (Actante)
            self.handle_actions(response)
            
            # 4. Resposta (Voz)
            clean_response = re.sub(r"\[\[ACTION:.*?\]\]", "", response).strip()
            bridge_ping("RESPOSTA", {"texto": clean_response[:200]})
            if self.speaker:
                self.speaker.speak(clean_response)
            else:
                print(f"[ALMA] {clean_response}")
            self.memory.add_history("ALMA", clean_response)


    def handle_actions(self, response):
        action_match = re.search(r"\[\[ACTION: (.*?)\]\]", response)
        if action_match:
            try:
                data = json.loads(action_match[1])
                action = data.get("action")
                target = data.get("target")
                
                if action == "open":
                    self.automation.open_app(target)
                elif action == "search":
                    self.web_agent.start()
                    info = self.web_agent.search_and_extract(target)
                    print(f"[ALMA] Informação encontrada na web: {info}")
                    # Injeta o resultado de volta para a próxima fala
                    self.web_agent.stop()
                elif action == "vision":
                    if self.vision:
                        self.vision.start_camera()
                        time.sleep(3)
                        self.vision.stop_camera()
                        self.speaker.speak("Ambiente escaneado visualmente.")
                    else:
                        self.speaker.speak("Módulo de visão está indisponível no momento.")
                elif action == "screenshot":
                    if self.automation:
                        path = self.automation.take_screenshot()
                        self.speaker.speak(f"Captura de tela realizada com sucesso, Comandante.")
                        print(f"[ALMA] Screenshot salvo em: {path}")
                        
                        # Se o alvo for telegram, envia via API
                        if target == "telegram" or "telegram" in response.lower():
                            self.speaker.speak("Enviando para o seu Telegram agora.")
                            self.send_to_telegram(path)
                elif action == "work_mode":
                    if self.automation:
                        self.automation.work_mode()
                        self.speaker.speak("Modo trabalho ativado. Aplicativos carregados.")
                elif action == "cleanup":
                    if self.automation:
                        self.automation.clean_temp()
                        self.speaker.speak("Limpeza de sistema concluída, Comandante.")
                elif action == "path":
                    if self.automation:
                        success = self.automation.open_path(target)
                        msg = f"Diretório {target} aberto." if success else f"Falha ao abrir {target}."
                        self.speaker.speak(msg)
                elif action == "update_memory":
                    key = data.get("key")
                    value = data.get("value")
                    if key and value:
                        self.memory.save_memory(key, value)
                        print(f"[ALMA] Memória de estado atualizada: {key} = {value}")
                elif action == "update_biography":
                    fact = data.get("fact")
                    if fact:
                        self.memory.update_biography(fact)
                        print(f"[ALMA] Novo fato biográfico registrado: {fact}")

            except Exception as e:
                print(f"[ERRO] Falha na execução da diretriz: {e}")

    def send_to_telegram(self, file_path):
        """Envia uma imagem para o Telegram via Core API."""
        try:
            import requests
            url = "http://localhost:3000/api/telegram/send-photo"
            headers = {"x-alma-key": os.environ.get("API_SECRET", "alma_secret_2026")}
            payload = {"path": os.path.abspath(file_path), "caption": "📸 Screenshot solicitado via Comando de Voz/Texto."}
            r = requests.post(url, json=payload, headers=headers)
            if r.status_code == 200:
                print("[ALMA] Foto enviada para o Telegram com sucesso.")
            else:
                print(f"[ALMA] Erro ao enviar para o Telegram: {r.text}")
        except Exception as e:
            print(f"[ALMA] Falha na conexão com o Telegram Bridge: {e}")

if __name__ == "__main__":
    try:
        jarvis = AlmaCore()
        jarvis.run()
    except KeyboardInterrupt:
        print("\n[INFO] Interrupção manual detectada.")
