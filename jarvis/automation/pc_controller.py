import pyautogui
import time
import os

class HermesAgent:
    def __init__(self):
        # Proteção: Se o mouse for para o canto da tela, o script para.
        pyautogui.FAILSAFE = True
        print("|| HERMES - AGENTE DE AUTOMAÇÃO ATIVADO ||")
        
    def open_app(self, app_name):
        print(f"[HERMES] Abrindo aplicativo: {app_name}")
        pyautogui.press('win')
        time.sleep(0.5)
        pyautogui.write(app_name)
        time.sleep(0.5)
        pyautogui.press('enter')

    def move_and_click(self, x, y):
        print(f"[HERMES] Movendo para ({x}, {y}) e clicando.")
        pyautogui.moveTo(x, y, duration=1)
        pyautogui.click()

    def screenshot(self, filename="last_view.png"):
        save_path = os.path.join("jarvis", "memory", filename)
        print(f"[HERMES] Capturando tela: {save_path}")
        pyautogui.screenshot(save_path)
        return save_path

    def type_text(self, text):
        print(f"[HERMES] Digitando texto...")
        pyautogui.write(text)

    def work_mode(self):
        """Abre o ambiente de trabalho padrão."""
        print("[HERMES] Iniciando MODO TRABALHO...")
        # Abre Chrome
        self.open_app("chrome")
        time.sleep(2)
        # Abre VS Code
        self.open_app("code")
        time.sleep(2)
        print("[HERMES] Ambiente de trabalho preparado.")

    def clean_temp(self):
        """Limpa arquivos temporários do Windows."""
        print("[HERMES] Iniciando LIMPEZA DE SISTEMA...")
        temp_paths = [
            os.environ.get('TEMP'),
            os.path.join(os.environ.get('SystemRoot', 'C:\\Windows'), 'Temp')
        ]
        for path in temp_paths:
            if path and os.path.exists(path):
                try:
                    print(f"[HERMES] Limpando: {path}")
                    # Apenas loga para segurança, ou executa se o user aprovou
                    # exec via shell para deletar (CUIDADO)
                    os.system(f'del /q/f/s {path}\\*')
                except Exception as e:
                    print(f"[ERRO] Falha ao limpar {path}: {e}")
        print("[HERMES] Limpeza concluída.")

    def open_path(self, target_path):
        """Abre uma pasta ou arquivo com busca inteligente e tolerância a erros de voz."""
        if not target_path or target_path == ".":
             target_path = os.getcwd()

        print(f"[HERMES] Tentando abrir: {target_path}")
        target_clean = target_path.lower().replace(".", "").replace(" ", "")
        
        # 1. Tentativa Direta
        if os.path.exists(target_path):
            os.startfile(target_path)
            return True
            
        # 2. Busca no diretório atual e subpastas (nível 1) com tolerância
        current_dir = os.getcwd()
        for item in os.listdir(current_dir):
            item_clean = item.lower().replace(".", "").replace(" ", "")
            # Verifica se o alvo está no item ou se o item está no alvo (tolerância a javis/jarvis)
            if target_clean in item_clean or item_clean in target_clean:
                full_path = os.path.join(current_dir, item)
                if os.path.isdir(full_path):
                    print(f"[HERMES] Encontrado via busca local (tolerância): {full_path}")
                    os.startfile(full_path)
                    return True

        # 3. Busca em pastas do usuário (Downloads, Documentos, Desktop)
        user_paths = [
            os.path.join(os.path.expanduser("~"), "Downloads"),
            os.path.join(os.path.expanduser("~"), "Documents"),
            os.path.join(os.path.expanduser("~"), "Desktop")
        ]
        
        for base in user_paths:
            if os.path.exists(base):
                for item in os.listdir(base):
                    item_clean = item.lower().replace(".", "").replace(" ", "")
                    if target_clean in item_clean or item_clean in target_clean:
                        full_path = os.path.join(base, item)
                        print(f"[HERMES] Encontrado em {base} (tolerância): {full_path}")
                        os.startfile(full_path)
                        return True

        print(f"[ERRO] Hermes não conseguiu encontrar nada para: {target_path}")
        return False
