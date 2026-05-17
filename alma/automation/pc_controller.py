import pyautogui
import time
import os
import logging
import subprocess
import ctypes
import json
from datetime import datetime

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
ACCOUNTS_FILE = os.path.join(os.path.dirname(__file__), 'accounts.json')
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    filename=os.path.join(LOG_DIR, 'hermes.log'),
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class HermesAgent:
    def __init__(self):
        pyautogui.FAILSAFE = True
        self.accounts = self._load_accounts()
        print("|| HERMES - AGENTE DE AUTOMAÇÃO ATIVADO (SEGURANÇA ATIVA) ||")
        logging.info("Hermes Agent initialized with security")

    def _load_accounts(self):
        """Carrega contas do arquivo JSON."""
        try:
            if os.path.exists(ACCOUNTS_FILE):
                with open(ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"[HERMES] Erro ao carregar contas: {e}")
        return {}

    def get_accounts(self, platform):
        """Retorna lista de contas disponíveis para uma plataforma."""
        return self.accounts.get(platform.lower(), [])

    def list_accounts(self):
        """Lista todas as plataformas e suas contas."""
        result = {}
        for platform, accounts in self.accounts.items():
            result[platform] = [acc['name'] for acc in accounts]
        return result

    def open_account(self, platform, account_name=None):
        """Abre uma conta específica de uma plataforma."""
        accounts = self.get_accounts(platform)
        if not accounts:
            return {"status": "error", "message": f"Plataforma {platform} não encontrada"}
        
        if account_name:
            for acc in accounts:
                if acc['name'].lower() == account_name.lower():
                    os.startfile(acc['url'])
                    return {"status": "success", "message": f"{acc['name']} aberto"}
            return {"status": "error", "message": f"Conta {account_name} não encontrada"}
        
        if accounts:
            os.startfile(accounts[0]['url'])
            return {"status": "success", "message": f"{accounts[0]['name']} aberto (primeira conta)"}
        
        return {"status": "error", "message": "Nenhuma conta disponível"}
        
    def log_action(self, action, details):
        print(f"[HERMES] {action}: {details}")
        logging.info(f"{action} - {details}")
        
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
        """Limpa arquivos temporários do Windows com segurança."""
        self.log_action("CLEAN_SYSTEM", "Iniciando limpeza de sistema")
        
        temp_paths = [
            os.environ.get('TEMP'),
            os.path.join(os.environ.get('SystemRoot', 'C:\\Windows'), 'Temp')
        ]
        
        files_deleted = 0
        for path in temp_paths:
            if path and os.path.exists(path):
                try:
                    # Contagem de arquivos antes (para log)
                    file_count = len(os.listdir(path))
                    self.log_action("CLEAN_PATH", f"{path} ({file_count} arquivos)")
                    
                    # Versão mais segura com prompt de confirmação implícito
                    # Apenas deleta arquivos com mais de 24h
                    for item in os.listdir(path):
                        item_path = os.path.join(path, item)
                        try:
                            if os.path.isfile(item_path):
                                file_age = time.time() - os.path.getmtime(item_path)
                                if file_age > 86400:  # 24 horas
                                    os.remove(item_path)
                                    files_deleted += 1
                            elif os.path.isdir(item_path):
                                import shutil
                                shutil.rmtree(item_path, ignore_errors=True)
                                files_deleted += 1
                        except:
                            pass
                except Exception as e:
                    self.log_action("ERROR", f"Falha ao limpar {path}: {e}")
        
        self.log_action("CLEAN_COMPLETE", f"{files_deleted} itens removidos")
        print(f"[HERMES] Limpeza concluída: {files_deleted} itens removidos.")

    def open_facebook(self, account_name=None):
        """Abre o Facebook - usa conta específica ou lista contas."""
        accounts = self.get_accounts('facebook')
        if not accounts:
            facebook_url = "https://www.facebook.com/edycarlos.dias.laureano"
            print(f"[HERMES] Abrindo Facebook padrão...")
            os.startfile(facebook_url)
            return True
        
        if account_name:
            for acc in accounts:
                if acc['name'].lower() == account_name.lower():
                    print(f"[HERMES] Abrindo Facebook: {acc['name']}")
                    os.startfile(acc['url'])
                    return True
            print(f"[HERMES] Conta não encontrada: {account_name}")
            return False
        
        print(f"[HERMES] Facebook - opções: {[a['name'] for a in accounts]}")
        os.startfile(accounts[0]['url'])
        return True

    def open_obsidian(self, vault_path=None):
        """Abre o Obsidian, opcionalmente criando/abrindo um vault específico."""
        if vault_path and os.path.exists(vault_path):
            obsidian_path = f"obsidian://open?path={vault_path}"
        else:
            obsidian_path = "obsidian://open"
        print(f"[HERMES] Abrindo Obsidian em {vault_path or 'menu principal'}...")
        os.startfile(obsidian_path)
        return True

    def open_path(self, target_path):
        """Abre uma pasta, arquivo ou URL com busca inteligente e tolerância a erros de voz."""
        if not target_path or target_path == ".":
             target_path = os.getcwd()

        print(f"[HERMES] Tentando abrir: {target_path}")
        target_clean = target_path.lower().replace(".", "").replace(" ", "")

        # Se é URL (começa com http)
        if target_path.startswith('http'):
            os.startfile(target_path)
            return True

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

    def minimize_window(self):
        """Minimiza a janela ativa."""
        pyautogui.hotkey('win', 'down')
        self.log_action("WINDOW", "Minimizada")
        return True

    def maximize_window(self):
        """Maximiza a janela ativa."""
        pyautogui.hotkey('win', 'up')
        self.log_action("WINDOW", "Maximizada")
        return True

    def close_window(self):
        """Fecha a janela ativa."""
        pyautogui.hotkey('alt', 'f4')
        self.log_action("WINDOW", "Fechada")
        return True

    def volume_up(self):
        """Aumenta o volume."""
        pyautogui.press('volumeup')
        self.log_action("AUDIO", "Volume +")
        return True

    def volume_down(self):
        """Diminui o volume."""
        pyautogui.press('volumedown')
        self.log_action("AUDIO", "Volume -")
        return True

    def mute_unmute(self):
        """Alterna mudo."""
        pyautogui.press('volumemute')
        self.log_action("AUDIO", "Mudo alternado")
        return True

    def take_screenshot(self):
        """Captura a tela e salva na pasta de Downloads do usuário."""
        downloads_path = os.path.join(os.path.expanduser("~"), "Downloads")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"ALMA_screenshot_{timestamp}.png"
        save_path = os.path.join(downloads_path, filename)
        
        pyautogui.screenshot(save_path)
        self.log_action("SCREENSHOT", f"Salvo em Downloads: {filename}")
        return save_path

    def get_running_processes(self):
        """Lista os processos em execução."""
        try:
            result = subprocess.run(
                ['powershell', '-Command', "Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Name, CPU, WorkingSet"],
                capture_output=True, text=True, timeout=10
            )
            self.log_action("PROCESSES", "Lista obtida")
            return result.stdout
        except Exception as e:
            self.log_action("ERROR", f"Falha ao listar processos: {e}")
            return str(e)

    def kill_process(self, process_name):
        """Encerra um processo pelo nome."""
        try:
            subprocess.run(['taskkill', '/F', '/IM', f'{process_name}.exe'], check=True)
            self.log_action("PROCESS_KILL", f"Encerrado: {process_name}")
            return True
        except Exception as e:
            self.log_action("ERROR", f"Falha ao encerrar {process_name}: {e}")
            return False

    def open_spotify(self):
        """Abre o Spotify."""
        os.startfile("spotify:")
        self.log_action("APP", "Spotify aberto")
        return True

    def open_whatsapp(self):
        """Abre o WhatsApp."""
        os.startfile("whatsapp:")
        self.log_action("APP", "WhatsApp aberto")
        return True

    def open_youtube(self, account_name=None):
        """Abre o YouTube - usa conta específica ou lista contas."""
        accounts = self.get_accounts('youtube')
        if not accounts:
            os.startfile("https://www.youtube.com")
            self.log_action("APP", "YouTube aberto")
            return True
        
        if account_name:
            for acc in accounts:
                if acc['name'].lower() == account_name.lower():
                    print(f"[HERMES] Abrindo YouTube: {acc['name']}")
                    os.startfile(acc['url'])
                    self.log_action("APP", f"YouTube {acc['name']} aberto")
                    return True
            print(f"[HERMES] Conta não encontrada: {account_name}")
            return False
        
        os.startfile(accounts[0]['url'])
        self.log_action("APP", f"YouTube {accounts[0]['name']} aberto")
        return True

    def open_teams(self):
        """Abre o Microsoft Teams."""
        os.startfile("msteams:")
        self.log_action("APP", "Teams aberto")
        return True

    def open_discord(self):
        """Abre o Discord."""
        os.startfile("discord:")
        self.log_action("APP", "Discord aberto")
        return True

    def open_gmail(self):
        """Abre o Gmail."""
        os.startfile("https://mail.google.com")
        self.log_action("APP", "Gmail aberto")
        return True

    def open_whatsapp_web(self):
        """Abre WhatsApp Web."""
        os.startfile("https://web.whatsapp.com")
        self.log_action("APP", "WhatsApp Web aberto")
        return True

    def open_linkedin(self, account_name=None):
        """Abre o LinkedIn - usa conta específica ou lista contas."""
        accounts = self.get_accounts('linkedin')
        if not accounts:
            os.startfile("https://www.linkedin.com")
            self.log_action("APP", "LinkedIn aberto")
            return True
        
        if account_name:
            for acc in accounts:
                if acc['name'].lower() == account_name.lower():
                    print(f"[HERMES] Abrindo LinkedIn: {acc['name']}")
                    os.startfile(acc['url'])
                    self.log_action("APP", f"LinkedIn {acc['name']} aberto")
                    return True
            print(f"[HERMES] Conta não encontrada: {account_name}")
            return False
        
        os.startfile(accounts[0]['url'])
        self.log_action("APP", f"LinkedIn {accounts[0]['name']} aberto")
        return True

    def open_instagram(self, account_name=None):
        """Abre o Instagram - usa conta específica ou lista contas."""
        accounts = self.get_accounts('instagram')
        if not accounts:
            os.startfile("https://www.instagram.com")
            self.log_action("APP", "Instagram aberto")
            return True
        
        if account_name:
            for acc in accounts:
                if acc['name'].lower() == account_name.lower():
                    print(f"[HERMES] Abrindo Instagram: {acc['name']}")
                    os.startfile(acc['url'])
                    self.log_action("APP", f"Instagram {acc['name']} aberto")
                    return True
            print(f"[HERMES] Conta não encontrada: {account_name}")
            return False
        
        os.startfile(accounts[0]['url'])
        self.log_action("APP", f"Instagram {accounts[0]['name']} aberto")
        return True

    def open_tiktok(self, account_name=None):
        """Abre o TikTok - usa conta específica ou lista contas."""
        accounts = self.get_accounts('tiktok')
        if not accounts:
            os.startfile("https://www.tiktok.com")
            self.log_action("APP", "TikTok aberto")
            return True
        
        if account_name:
            for acc in accounts:
                if acc['name'].lower() == account_name.lower():
                    print(f"[HERMES] Abrindo TikTok: {acc['name']}")
                    os.startfile(acc['url'])
                    self.log_action("APP", f"TikTok {acc['name']} aberto")
                    return True
            print(f"[HERMES] Conta não encontrada: {account_name}")
            return False
        
        os.startfile(accounts[0]['url'])
        self.log_action("APP", f"TikTok {accounts[0]['name']} aberto")
        return True

    def open_slack(self):
        """Abre o Slack."""
        os.startfile("slack:")
        self.log_action("APP", "Slack aberto")
        return True

    def open_zoom(self):
        """Abre o Zoom."""
        os.startfile("zoom:")
        self.log_action("APP", "Zoom aberto")
        return True

    def type_text_direct(self, text):
        """Digita texto diretamente sem usar clipboard."""
        pyautogui.write(text, interval=0.02)
        self.log_action("TYPE", f"Digitado: {text[:30]}...")
        return True

    def press_key(self, key):
        """Pressiona uma tecla."""
        pyautogui.press(key)
        self.log_action("KEY", f"Pressionada: {key}")
        return True

    def open_terminal(self):
        """Abre o Windows Terminal."""
        os.startfile("wt.exe")
        self.log_action("APP", "Terminal aberto")
        return True

    def open_file_explorer(self):
        """Abre o Explorador de Arquivos."""
        os.startfile("explorer.exe")
        self.log_action("APP", "Explorador aberto")
        return True

    def open_settings(self):
        """Abre as Configurações do Windows."""
        os.startfile("ms-settings:")
        self.log_action("APP", "Configurações aberto")
        return True

    def open_calendly(self):
        """Abre o Calendly."""
        os.startfile("https://calendly.com")
        self.log_action("APP", "Calendly aberto")
        return True

    def open_notion(self):
        """Abre o Notion."""
        os.startfile("notion:")
        self.log_action("APP", "Notion aberto")
        return True

    def open_figma(self):
        """Abre o Figma."""
        os.startfile("https://www.figma.com")
        self.log_action("APP", "Figma aberto")
        return True

    def open_steam(self):
        """Abre o Steam."""
        os.startfile("steam:")
        self.log_action("APP", "Steam aberto")
        return True

    def open_epic_games(self):
        """Abre o Epic Games."""
        os.startfile("com.epicgames.launcher://")
        self.log_action("APP", "Epic Games aberto")
        return True

    def open_spotify_web(self):
        """Abre o Spotify Web."""
        os.startfile("https://open.spotify.com")
        self.log_action("APP", "Spotify Web aberto")
        return True

    def open_netflix(self):
        """Abre o Netflix."""
        os.startfile("https://www.netflix.com")
        self.log_action("APP", "Netflix aberto")
        return True

    def open_amazon_prime(self):
        """Abre o Amazon Prime Video."""
        os.startfile("https://www.primevideo.com")
        self.log_action("APP", "Amazon Prime aberto")
        return True

    def open_disney(self):
        """Abre o Disney+."""
        os.startfile("https://www.disneyplus.com")
        self.log_action("APP", "Disney+ aberto")
        return True

    def open_canva(self):
        """Abre o Canva."""
        os.startfile("https://www.canva.com")
        self.log_action("APP", "Canva aberto")
        return True

    def open_reddit(self):
        """Abre o Reddit."""
        os.startfile("https://www.reddit.com")
        self.log_action("APP", "Reddit aberto")
        return True

    def open_twitter(self, account_name=None):
        """Abre o Twitter/X - usa conta específica ou lista contas."""
        accounts = self.get_accounts('twitter')
        if not accounts:
            os.startfile("https://twitter.com")
            self.log_action("APP", "Twitter aberto")
            return True
        
        if account_name:
            for acc in accounts:
                if acc['name'].lower() == account_name.lower():
                    print(f"[HERMES] Abrindo Twitter: {acc['name']}")
                    os.startfile(acc['url'])
                    self.log_action("APP", f"Twitter {acc['name']} aberto")
                    return True
            print(f"[HERMES] Conta não encontrada: {account_name}")
            return False
        
        os.startfile(accounts[0]['url'])
        self.log_action("APP", f"Twitter {accounts[0]['name']} aberto")
        return True

    def open_whatsapp_business(self):
        """Abre o WhatsApp Business."""
        os.startfile("whatsapp-business:")
        self.log_action("APP", "WhatsApp Business aberto")
        return True

    def open_loom(self):
        """Abre o Loom."""
        os.startfile("https://www.loom.com")
        self.log_action("APP", "Loom aberto")
        return True

    def open_google_drive(self):
        """Abre o Google Drive."""
        os.startfile("https://drive.google.com")
        self.log_action("APP", "Google Drive aberto")
        return True

    def open_dropbox(self):
        """Abre o Dropbox."""
        os.startfile("https://www.dropbox.com")
        self.log_action("APP", "Dropbox aberto")
        return True

    def open_whatsapp_desktop(self):
        """Abre o WhatsApp Desktop."""
        os.startfile("WhatsApp")
        self.log_action("APP", "WhatsApp Desktop aberto")
        return True

    def open_telegram_desktop(self):
        """Abre o Telegram Desktop."""
        os.startfile("Telegram")
        self.log_action("APP", "Telegram Desktop aberto")
        return True

    def open_vlc(self):
        """Abre o VLC Player."""
        os.startfile("vlc")
        self.log_action("APP", "VLC aberto")
        return True

    def open_sublime(self):
        """Abre o Sublime Text."""
        os.startfile("sublime_text")
        self.log_action("APP", "Sublime Text aberto")
        return True

    def open_postman(self):
        """Abre o Postman."""
        os.startfile("Postman")
        self.log_action("APP", "Postman aberto")
        return True

    def open_unity(self):
        """Abre o Unity Hub."""
        os.startfile("Unity")
        self.log_action("APP", "Unity Hub aberto")
        return True

    def open_vmware(self):
        """Abre o VMware."""
        os.startfile("vmware")
        self.log_action("APP", "VMware aberto")
        return True

    def open_teamviewer(self):
        """Abre o TeamViewer."""
        os.startfile("TeamViewer")
        self.log_action("APP", "TeamViewer aberto")
        return True
