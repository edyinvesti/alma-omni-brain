import os
import time
import re
import json
import asyncio
from dotenv import load_dotenv
from brain.llm import JarvisBrain
from voice.speaker import JarvisSpeaker
from voice.listener import JarvisListener
from automation.pc_controller import HermesAgent
from memory.memory_manager import JarvisMemory
from web_agent.agent import AthenaAgent
from vision.detector import JarvisVision

# Carrega variáveis de ambiente do .env
load_dotenv()

# Detecta se está em modo nuvem
IS_CLOUD = os.getenv("CLOUD_MODE", "false").lower() == "true"

class JarvisCore:
    def __init__(self):
        print(f"|| JARVIS - SISTEMA DE INTELIGÊNCIA MASTER {'[CLOUD MODE]' if IS_CLOUD else '[LOCAL MODE]'} ||")
        self.memory = JarvisMemory("MasterProject")
        self.brain = JarvisBrain()
        
        if IS_CLOUD:
            print("[INFO] Rodando em modo nuvem. Módulos físicos (Voz/Visão/PC) desativados.")
            self.speaker = None
            self.listener = None
            self.automation = None
            self.vision = None
        else:
            self.speaker = JarvisSpeaker()
            self.listener = JarvisListener()
            self.automation = HermesAgent()
            try:
                self.vision = JarvisVision()
            except Exception as e:
                print(f"[AVISO] Módulo de visão inativo: {e}")
                self.vision = None
        
        self.web_agent = AthenaAgent()
        self.running = True

    def run(self):
        context = self.memory.get_context()
        welcome_msg = f"Bem-vindo de volta, {self.memory.data['user_name']}. Todos os sistemas {'online' if IS_CLOUD else 'operacionais'}."
        
        if self.speaker:
            self.speaker.speak(welcome_msg)
        else:
            print(f"[JARVIS] {welcome_msg}")
        
        while self.running:
            # 1. Entrada
            if IS_CLOUD:
                # Na nuvem, o Jarvis aguarda comandos via API/Telegram (que alimentam o buffer ou histórico)
                # Por enquanto, aguardamos input no console como fallback ou simulamos o loop
                time.sleep(10) 
                continue 

            command = self.listener.listen()
            if not command: continue
            
            self.memory.add_history("Comandante", command)
            
            if "desativar" in command.lower():
                self.speaker.speak("Desativando sistemas centrais. Até logo, Comandante.")
                break
            
            # 2. Raciocínio (Cérebro)
            print("[JARVIS] Consultando matriz neural...")
            response = self.brain.think(command, context=context)
            
            # 3. Execução de Ações (Actante)
            self.handle_actions(response)
            
            # 4. Resposta (Voz)
            clean_response = re.sub(r"\[\[ACTION:.*?\]\]", "", response).strip()
            if self.speaker:
                self.speaker.speak(clean_response)
            else:
                print(f"[JARVIS] {clean_response}")
            self.memory.add_history("JARVIS", clean_response)

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
                    print(f"[JARVIS] Informação encontrada na web: {info}")
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
                        print(f"[JARVIS] Memória de estado atualizada: {key} = {value}")
                elif action == "update_biography":
                    fact = data.get("fact")
                    if fact:
                        self.memory.update_biography(fact)
                        print(f"[JARVIS] Novo fato biográfico registrado: {fact}")

            except Exception as e:
                print(f"[ERRO] Falha na execução da diretriz: {e}")

if __name__ == "__main__":
    try:
        jarvis = JarvisCore()
        jarvis.run()
    except KeyboardInterrupt:
        print("\n[INFO] Interrupção manual detectada.")
