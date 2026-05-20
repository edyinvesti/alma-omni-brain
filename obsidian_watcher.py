import os
import time
import json
import urllib.request
from datetime import datetime

# Configurações
VAULT_PATH = os.getenv("OBSIDIAN_VAULT_PATH", r"C:\Users\User\Downloads\jarvis.html")
WATCH_DIRS = [
    os.path.join(VAULT_PATH, "ALMA Notes"),
    os.path.join(VAULT_PATH, "Daily Notes"),
    os.path.join(r"C:\Users\User\Downloads\IAmobil_Vault\IAmobil_Vault", "01_Leads"),
    os.path.join(r"C:\Users\User\Downloads\IAmobil_Vault\IAmobil_Vault", "02_Imoveis")
]

# ALMA Cloud Endpoint (pega do .env ou usa o padrão do render)
# Como o watcher roda no PC, o ALMA_URL deve ser o link do render.
# O usuário pode setar no .env ALMA_CLOUD_URL=https://alma-omni-brain-1.onrender.com
# Mas para evitar complicações, vamos chumbá-lo temporariamente caso falhe:
ALMA_CLOUD_URL = os.getenv("ALMA_CLOUD_URL", "https://alma-omni-brain-1.onrender.com")
HERMES_API_KEY = os.getenv("HERMES_API_KEY", "alma_secure_key_2024")
INGEST_URL = f"{ALMA_CLOUD_URL}/api/alma/ingest_knowledge"

last_scanned = time.time()

print("=============================================")
print(" 🤖 ALMA - Agente Bibliotecário (Modo Híbrido)")
print(f" 📂 Vigiando cofre em: {VAULT_PATH}")
print(f" ☁️ Nuvem alvo: {ALMA_CLOUD_URL}")
print("=============================================\n")

def push_to_cloud(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        
        if not content:
            return
            
        title = os.path.basename(filepath).replace('.md', '')
        # Se for daily notes, o título já é a data.
        
        payload = json.dumps({
            "title": title,
            "content": content,
            "source": f"obsidian_sync_{title}"
        }).encode('utf-8')

        req = urllib.request.Request(INGEST_URL, data=payload, method='POST')
        req.add_header('Content-Type', 'application/json')
        req.add_header('Authorization', f'Bearer {HERMES_API_KEY}')

        print(f"[{datetime.now().strftime('%H:%M:%S')}] 📚 Enviando nota '{title}' para RAG Cloud...", end="")
        
        with urllib.request.urlopen(req, timeout=15) as response:
            if response.status == 200:
                print(" ✅ Sucesso (Vetorizado no Turso)")
            else:
                print(f" ❌ Erro: HTTP {response.status}")
                
    except Exception as e:
        print(f" ❌ Falhou: {str(e)}")

while True:
    current_time = time.time()
    files_to_sync = []
    
    for watch_dir in WATCH_DIRS:
        if not os.path.exists(watch_dir):
            continue
            
        for filename in os.listdir(watch_dir):
            if filename.endswith(".md"):
                filepath = os.path.join(watch_dir, filename)
                try:
                    mtime = os.path.getmtime(filepath)
                    # Se arquivo foi modificado DEPOIS do nosso último scan
                    if mtime > last_scanned:
                        files_to_sync.append(filepath)
                except Exception:
                    pass

    last_scanned = current_time

    for fpath in files_to_sync:
        push_to_cloud(fpath)

    # Verifica a cada 5 segundos
    time.sleep(5)
