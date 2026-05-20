from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from pc_controller import HermesAgent
import traceback
import subprocess
import os
import logging

from flask_cors import CORS
app = Flask(__name__)
CORS(app)
hermes = HermesAgent()

HERMES_API_KEY = os.environ.get('HERMES_API_KEY')
if not HERMES_API_KEY:
    raise ValueError("HERMES_API_KEY não configurada no .env")

ALLOWED_COMMANDS = {
    'chrome': 'Abrir navegador Chrome',
    'spotify': 'Abrir Spotify',
    'whatsapp': 'Abrir WhatsApp',
    'youtube': 'Abrir YouTube',
    'teams': 'Abrir Microsoft Teams',
    'discord': 'Abrir Discord',
    'gmail': 'Abrir Gmail',
    'linkedin': 'Abrir LinkedIn',
    'instagram': 'Abrir Instagram',
    'slack': 'Abrir Slack',
    'zoom': 'Abrir Zoom',
    'facebook': 'Abrir Facebook',
    'obs': 'Abrir OBS Studio',
    'obsidian': 'Abrir Obsidian',
    'calc': 'Abrir calculadora',
    'notepad': 'Abrir bloco de notas',
    'powershell': 'Abrir terminal',
    'terminal': 'Abrir Windows Terminal',
    'code': 'Abrir VSCode',
    'explorer': 'Abrir Explorador de Arquivos',
    'settings': 'Abrir Configurações',
    'calendly': 'Abrir Calendly',
    'whatsapp web': 'Abrir WhatsApp Web',
    'tiktok': 'Abrir TikTok',
    'minimizar': 'Minimizar janela',
    'maximizar': 'Maximizar janela',
    'fechar': 'Fechar janela',
    'volume +': 'Aumentar volume',
    'volume -': 'Diminuir volume',
    'mudo': 'Alternar mudo',
    'screenshot': 'Capturar tela',
    'type': 'Digitar texto',
    'press': 'Pressionar tecla',
}

import hmac
import secrets

def verify_api_key(request):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return False
    token = auth_header[7:]
    return hmac.compare_digest(token, HERMES_API_KEY)

@app.route('/api/hermes/exec', methods=['POST'])
def exec_command():
    """Executa um comando shell generico vindo da nuvem (pesquisa, abrir apps, etc.)"""
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    
    try:
        data = request.json or {}
        command = data.get('command', '').strip()
        if not command:
            return jsonify({"status": "error", "message": "Nenhum comando fornecido"}), 400
        
        # Whitelist de comandos permitidos
        command_lower = command.lower()
        is_allowed = any(cmd in command_lower for cmd in ALLOWED_COMMANDS.keys())
        
        if not is_allowed:
            print(f"[HERMES SECURITY] Comando bloqueado: {command}")
            return jsonify({"status": "error", "message": "Comando não permitido"}), 403
        
        print(f"[HERMES EXEC] Executando: {command}")
        subprocess.Popen(command, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return jsonify({"status": "success", "message": f"Comando executado: {command}"})
    except Exception as e:
        logging.error(f"[HERMES EXEC ERROR] {str(e)} - {traceback.format_exc()}")
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/work_mode', methods=['POST'])
def work_mode():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        hermes.work_mode()
        return jsonify({"status": "success", "message": "Work mode activated"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/clean_system', methods=['POST'])
def clean_system():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        confirm = request.json.get('confirm', False)
        if not confirm:
            return jsonify({"status": "warning", "message": "Confirme a limpeza enviando {'confirm': true}"})
        hermes.clean_temp()
        return jsonify({"status": "success", "message": "System cleaned"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/open_path', methods=['POST'])
def open_path():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        data = request.json
        path = data.get('path', '')
        success = hermes.open_path(path)
        if success:
            return jsonify({"status": "success", "message": f"Opened {path}"})
        else:
            return jsonify({"status": "error", "message": f"Could not find or open {path}"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/facebook', methods=['POST'])
def open_facebook():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        data = request.json or {}
        account = data.get('account', None)
        accounts = hermes.get_accounts('facebook')
        if accounts and not account:
            account_names = [a['name'] for a in accounts]
            hermes.open_facebook(None)
            return jsonify({
                "status": "success", 
                "message": f"Facebook aberto - contas disponíveis: {account_names}",
                "available_accounts": account_names
            })
        hermes.open_facebook(account)
        return jsonify({"status": "success", "message": "Facebook opened"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/obsidian', methods=['POST'])
def open_obsidian():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        data = request.json or {}
        vault = data.get('vault', None)
        if vault and os.path.exists(vault):
            hermes.open_obsidian(vault)
            return jsonify({"status": "success", "message": f"Obsidian opened - {vault}"})
        else:
            hermes.open_obsidian()
            return jsonify({"status": "success", "message": "Obsidian opened"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/linkedin', methods=['POST'])
def open_linkedin():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        data = request.json or {}
        account = data.get('account', None)
        accounts = hermes.get_accounts('linkedin')
        if accounts and not account:
            account_names = [a['name'] for a in accounts]
            hermes.open_linkedin(None)
            return jsonify({
                "status": "success", 
                "message": f"LinkedIn aberto - contas disponíveis: {account_names}",
                "available_accounts": account_names
            })
        hermes.open_linkedin(account)
        return jsonify({"status": "success", "message": "LinkedIn opened"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/instagram', methods=['POST'])
def open_instagram():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        data = request.json or {}
        account = data.get('account', None)
        accounts = hermes.get_accounts('instagram')
        if accounts and not account:
            account_names = [a['name'] for a in accounts]
            hermes.open_instagram(None)
            return jsonify({
                "status": "success", 
                "message": f"Instagram aberto - contas disponíveis: {account_names}",
                "available_accounts": account_names
            })
        hermes.open_instagram(account)
        return jsonify({"status": "success", "message": "Instagram opened"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/tiktok', methods=['POST'])
def open_tiktok():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        data = request.json or {}
        account = data.get('account', None)
        accounts = hermes.get_accounts('tiktok')
        if accounts and not account:
            account_names = [a['name'] for a in accounts]
            hermes.open_tiktok(None)
            return jsonify({
                "status": "success", 
                "message": f"TikTok aberto - contas disponíveis: {account_names}",
                "available_accounts": account_names
            })
        hermes.open_tiktok(account)
        return jsonify({"status": "success", "message": "TikTok opened"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/twitter', methods=['POST'])
def open_twitter():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        data = request.json or {}
        account = data.get('account', None)
        accounts = hermes.get_accounts('twitter')
        if accounts and not account:
            account_names = [a['name'] for a in accounts]
            hermes.open_twitter(None)
            return jsonify({
                "status": "success", 
                "message": f"Twitter aberto - contas disponíveis: {account_names}",
                "available_accounts": account_names
            })
        hermes.open_twitter(account)
        return jsonify({"status": "success", "message": "Twitter opened"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/youtube', methods=['POST'])
def open_youtube():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        data = request.json or {}
        account = data.get('account', None)
        accounts = hermes.get_accounts('youtube')
        if accounts and not account:
            account_names = [a['name'] for a in accounts]
            hermes.open_youtube(None)
            return jsonify({
                "status": "success", 
                "message": f"YouTube aberto - contas disponíveis: {account_names}",
                "available_accounts": account_names
            })
        hermes.open_youtube(account)
        return jsonify({"status": "success", "message": "YouTube opened"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/window', methods=['POST'])
def window_control():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        action = request.json.get('action', '')
        if action == 'minimize':
            hermes.minimize_window()
            return jsonify({"status": "success", "message": "Window minimized"})
        elif action == 'maximize':
            hermes.maximize_window()
            return jsonify({"status": "success", "message": "Window maximized"})
        elif action == 'close':
            hermes.close_window()
            return jsonify({"status": "success", "message": "Window closed"})
        else:
            return jsonify({"status": "error", "message": "Invalid action. Use: minimize, maximize, close"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/hermes/volume', methods=['POST'])
def volume_control():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        action = request.json.get('action', '')
        if action == 'up':
            hermes.volume_up()
            return jsonify({"status": "success", "message": "Volume increased"})
        elif action == 'down':
            hermes.volume_down()
            return jsonify({"status": "success", "message": "Volume decreased"})
        elif action == 'mute':
            hermes.mute_unmute()
            return jsonify({"status": "success", "message": "Mute toggled"})
        else:
            return jsonify({"status": "error", "message": "Invalid action. Use: up, down, mute"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/hermes/screenshot', methods=['GET'])
def screenshot():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        path = hermes.take_screenshot()
        return jsonify({"status": "success", "message": "Screenshot captured", "path": path})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/hermes/processes', methods=['GET'])
def list_processes():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        processes = hermes.get_running_processes()
        return jsonify({"status": "success", "processes": processes})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/hermes/kill', methods=['POST'])
def kill_process():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        process_name = request.json.get('process', '')
        if not process_name:
            return jsonify({"status": "error", "message": "Process name required"}), 400
        success = hermes.kill_process(process_name)
        if success:
            return jsonify({"status": "success", "message": f"Process {process_name} terminated"})
        else:
            return jsonify({"status": "error", "message": f"Failed to terminate {process_name}"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/hermes/app', methods=['POST'])
def open_app():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        app_name = request.json.get('app', '').lower()
        apps = {
            'spotify': hermes.open_spotify,
            'spotify web': hermes.open_spotify_web,
            'whatsapp': hermes.open_whatsapp,
            'whatsapp business': hermes.open_whatsapp_business,
            'youtube': hermes.open_youtube,
            'teams': hermes.open_teams,
            'discord': hermes.open_discord,
            'gmail': hermes.open_gmail,
            'whatsapp web': hermes.open_whatsapp_web,
            'linkedin': hermes.open_linkedin,
            'instagram': hermes.open_instagram,
            'slack': hermes.open_slack,
            'zoom': hermes.open_zoom,
            'terminal': hermes.open_terminal,
            'explorer': hermes.open_file_explorer,
            'settings': hermes.open_settings,
            'calendly': hermes.open_calendly,
            'notion': hermes.open_notion,
            'figma': hermes.open_figma,
            'steam': hermes.open_steam,
            'epic games': hermes.open_epic_games,
            'netflix': hermes.open_netflix,
            'amazon prime': hermes.open_amazon_prime,
            'disney': hermes.open_disney,
            'disney+': hermes.open_disney,
            'canva': hermes.open_canva,
            'reddit': hermes.open_reddit,
            'twitter': hermes.open_twitter,
            'x': hermes.open_twitter,
            'loom': hermes.open_loom,
            'google drive': hermes.open_google_drive,
            'drive': hermes.open_google_drive,
            'dropbox': hermes.open_dropbox,
            'whatsapp desktop': hermes.open_whatsapp_desktop,
            'telegram': hermes.open_telegram_desktop,
            'telegram desktop': hermes.open_telegram_desktop,
            'vlc': hermes.open_vlc,
            'sublime': hermes.open_sublime,
            'sublime text': hermes.open_sublime,
            'postman': hermes.open_postman,
            'unity': hermes.open_unity,
            'vmware': hermes.open_vmware,
            'teamviewer': hermes.open_teamviewer,
            'tiktok': hermes.open_tiktok,
            'facebook': hermes.open_facebook,
            'linkedin': hermes.open_linkedin,
            'instagram': hermes.open_instagram,
            'obsidian': hermes.open_obsidian,
            'code': hermes.open_app,
            'chrome': hermes.open_app,
        }
        if app_name in apps:
            account = None
            if request.json:
                account = request.json.get('account')
            if app_name in ['facebook', 'linkedin', 'instagram', 'tiktok'] and account:
                apps[app_name](account)
            else:
                apps[app_name]()
            return jsonify({"status": "success", "message": f"{app_name} opened"})
        else:
            return jsonify({"status": "error", "message": f"App {app_name} not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/hermes/type', methods=['POST'])
def type_text():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        text = request.json.get('text', '')
        if not text:
            return jsonify({"status": "error", "message": "Text required"}), 400
        hermes.type_text_direct(text)
        return jsonify({"status": "success", "message": "Text typed"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/hermes/press', methods=['POST'])
def press_key():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        key = request.json.get('key', '')
        if not key:
            return jsonify({"status": "error", "message": "Key required"}), 400
        hermes.press_key(key)
        return jsonify({"status": "success", "message": f"Key {key} pressed"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/hermes/voice', methods=['POST'])
def generate_voice():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    try:
        data = request.json or {}
        text = data.get('text', '')
        chat_id = data.get('chat_id', '')
        
        if not text or not chat_id:
            return jsonify({"status": "error", "message": "Text and chat_id required"}), 400
            
        temp_wav = os.path.join(os.environ.get('TEMP', '/tmp'), f"alma_hibrido_{int(time.time())}.wav")
        sanitized = text.replace("'", "''").replace('"', '\"')
        
        # Gera o áudio via PowerShell
        ps_cmd = f"Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('{temp_wav}'); $s.Speak('{sanitized}'); $s.Dispose()"
        subprocess.run(["powershell", "-Command", ps_cmd], check=True)
        
        if os.path.exists(temp_wav):
            # Envia para o Telegram usando o Token do .env
            token = os.environ.get('TELEGRAM_BOT_TOKEN')
            url = f"https://api.telegram.org/bot{token}/sendVoice"
            
            with open(temp_wav, 'rb') as voice_file:
                files = {'voice': voice_file}
                payload = {'chat_id': chat_id}
                import requests
                r = requests.post(url, data=payload, files=files)
            
            os.remove(temp_wav)
            if r.status_code == 200:
                return jsonify({"status": "success", "message": "Voz enviada do PC local"})
            else:
                return jsonify({"status": "error", "message": f"Erro Telegram: {r.text}"}), 500
        
        return jsonify({"status": "error", "message": "Falha na geração do arquivo"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/hermes/status', methods=['GET'])
def status():
    return jsonify({"status": "online", "version": "2.0.0-secure"})

@app.route('/api/hermes/accounts', methods=['GET'])
def list_accounts():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        accounts = hermes.list_accounts()
        return jsonify({"status": "success", "accounts": accounts})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/hermes/accounts/<platform>', methods=['GET'])
def get_platform_accounts(platform):
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        accounts = hermes.get_accounts(platform)
        return jsonify({"status": "success", "platform": platform, "accounts": accounts})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/hermes/open_account', methods=['POST'])
def open_account():
    if not verify_api_key(request):
        return jsonify({"status": "error", "message": "Unauthorized - Invalid API Key"}), 401
    try:
        platform = request.json.get('platform', '').lower()
        account = request.json.get('account', None)
        if not platform:
            return jsonify({"status": "error", "message": "Platform required"}), 400
        result = hermes.open_account(platform, account)
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    print("|| HERMES DAEMON INICIADO (PORTA 3001) ||")
    app.run(host='0.0.0.0', port=3001, threaded=True)
