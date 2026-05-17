import os
import time
import requests
import sqlite3
import psutil
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_ADMIN_CHAT_ID = os.getenv("TELEGRAM_ADMIN_CHAT_ID")
HEALTH_CHECK_URL = "http://localhost:3000/health"
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "telemetry.db")

class SentinelAgent:
    def __init__(self):
        print("|| SENTINEL - PROTOCOLO DE SEGURANÇA ATIVADO ||")
        self.last_log_id = 0
        self.initialize_state()

    def initialize_state(self):
        """Pega o último ID do log para começar a monitorar a partir daqui."""
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT MAX(id) FROM logs")
            row = cursor.fetchone()
            self.last_log_id = row[0] if row[0] else 0
            conn.close()
        except Exception as e:
            print(f"[SENTINEL] Erro ao acessar banco de dados: {e}")

    def send_telegram_alert(self, message):
        """Envia um alerta de alta prioridade para o admin."""
        if not TELEGRAM_BOT_TOKEN or not TELEGRAM_ADMIN_CHAT_ID:
            return
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": TELEGRAM_ADMIN_CHAT_ID,
            "text": f"🚨 [ALERTA DO GUARDIÃO SENTINEL]\n\n{message}",
            "parse_mode": "Markdown"
        }
        try:
            requests.post(url, json=payload)
        except Exception as e:
            print(f"[SENTINEL] Falha ao enviar alerta Telegram: {e}")

    def scan_telemetry_anomalies(self):
        """Escaneia o banco em busca de novas tags de segurança."""
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT id, source, message FROM logs WHERE id > ? AND (source = 'SENTINEL' OR message LIKE '%ALERTA%')", (self.last_log_id,))
            rows = cursor.fetchall()
            for row in rows:
                log_id, source, message = row
                print(f"[SENTINEL] Anomalia detectada: {message}")
                self.send_telegram_alert(message)
                self.last_log_id = max(self.last_log_id, log_id)
            conn.close()
        except Exception as e:
            pass # Banco pode estar ocupado

    def check_service_health(self):
        """Verifica se o backend Node.js está respondendo."""
        try:
            res = requests.get(HEALTH_CHECK_URL, timeout=5)
            if res.status_code != 200:
                self.send_telegram_alert("⚠️ O Core A.L.M.A. (Node.js) não está respondendo corretamente. Status: " + str(res.status_code))
        except Exception:
            self.send_telegram_alert("💀 **CRÍTICO**: O Core A.L.M.A. (Node.js) parece estar OFFLINE!")

    def monitor_system_resources(self):
        """Monitora uso excessivo de CPU/RAM."""
        cpu = psutil.cpu_percent()
        if cpu > 90:
            self.send_telegram_alert(f"🔥 **ALERTA DE RECURSOS**: Uso de CPU crítico em {cpu}%")

    def run(self):
        """Loop principal do Sentinel."""
        while True:
            self.scan_telemetry_anomalies()
            self.check_service_health()
            self.monitor_system_resources()
            time.sleep(30) # Verifica a cada 30 segundos

if __name__ == "__main__":
    sentinel = SentinelAgent()
    try:
        sentinel.run()
    except KeyboardInterrupt:
        print("[SENTINEL] Desativado manualmente.")
