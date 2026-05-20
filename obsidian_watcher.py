import os
import time
import json
import urllib.request
from datetime import datetime

# ============================================================
# CONFIGURAÇÃO - Onde estão as empresas?
# ============================================================
# Mude apenas este caminho para a pasta que contém suas empresas
COMPANIES_ROOT = r"C:\Users\User\Downloads\Companies"

# Pastas dentro de cada empresa que queremos vigiar
# (não precisa mexer aqui ao adicionar empresa)
WATCH_SUBDIRS = ["Leads", "Imóveis", "Notes", "Daily Notes", "Notas", "01_Leads", "02_Imoveis", "03_Clientes", "04_Vendas", "05_Relatorios", "07_Oportunidades"]

# ============================================================
# CONFIGURAÇÃO - Para onde enviar os dados
# ============================================================
VAULT_PATH = os.getenv("OBSIDIAN_VAULT_PATH", r"C:\Users\User\Downloads\jarvis.html")
ALMA_CLOUD_URL = os.getenv("ALMA_CLOUD_URL", "https://alma-omni-brain-1.onrender.com")
HERMES_API_KEY = os.getenv("HERMES_API_KEY", "alma_secure_key_2024")
INGEST_URL = f"{ALMA_CLOUD_URL}/api/alma/ingest_knowledge"

last_scanned = time.time()

def discover_watch_dirs():
    """Detecta automaticamente todas as pastas de empresas."""
    watch_dirs = []
    
    if not os.path.exists(COMPANIES_ROOT):
        print(f"PASTA NAO ENCONTRADA: {COMPANIES_ROOT}")
        return watch_dirs
    
    for company in os.listdir(COMPANIES_ROOT):
        company_path = os.path.join(COMPANIES_ROOT, company)
        
        if not os.path.isdir(company_path):
            continue
            
        # Adicionar subpastas relevantes
        for subdir in WATCH_SUBDIRS:
            sub_path = os.path.join(company_path, subdir)
            if os.path.exists(sub_path):
                watch_dirs.append(sub_path)
                print(f"  + {company}/{subdir}")
    
    return watch_dirs

def push_to_cloud(filepath, company):
    """Envia nota para o servidor na nuvem."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        
        if not content:
            return
            
        title = os.path.basename(filepath).replace('.md', '')
        
        payload = json.dumps({
            "title": title,
            "content": content,
            "source": f"obsidian_sync_{company}_{title}"
        }).encode('utf-8')

        req = urllib.request.Request(INGEST_URL, data=payload, method='POST')
        req.add_header('Content-Type', 'application/json')
        req.add_header('Authorization', f'Bearer {HERMES_API_KEY}')

        print(f"[{datetime.now().strftime('%H:%M:%S')}] [SYNC] {company}: {title}...", end="")
        
        with urllib.request.urlopen(req, timeout=15) as response:
            if response.status == 200:
                print(" OK")
            else:
                print(f" ERRO: HTTP {response.status}")
                
    except Exception as e:
        print(f" ERRO: {str(e)}")

def main():
    print("=" * 50)
    print(" [ALMA] Watcher Automatico de Empresas")
    print(f" [PASTA] {COMPANIES_ROOT}")
    print(f" [NUVEM] {ALMA_CLOUD_URL}")
    print("=" * 50)
    
    WATCH_DIRS = discover_watch_dirs()
    
    if not WATCH_DIRS:
        print("\nAVISO: Nenhuma pasta encontrada para vigiar!")
        print("   Crie a pasta empresas em:", COMPANIES_ROOT)
        return
    
    print(f"\nMonitorando {len(WATCH_DIRS)} pastas...\n")
    
    global last_scanned
    last_scanned = time.time()
    
    while True:
        current_time = time.time()
        files_to_sync = []
        
        for watch_dir in WATCH_DIRS:
            if not os.path.exists(watch_dir):
                continue
            
            company = os.path.basename(os.path.dirname(watch_dir))
            
            for filename in os.listdir(watch_dir):
                if filename.endswith(".md"):
                    filepath = os.path.join(watch_dir, filename)
                    try:
                        mtime = os.path.getmtime(filepath)
                        if mtime > last_scanned:
                            files_to_sync.append((filepath, company))
                    except Exception:
                        pass

        last_scanned = current_time

        for fpath, company in files_to_sync:
            push_to_cloud(fpath, company)

        time.sleep(5)

if __name__ == "__main__":
    main()