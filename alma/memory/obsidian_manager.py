import os
from datetime import datetime

class ObsidianVault:
    def __init__(self):
        self.vault_path = os.getenv("OBSIDIAN_VAULT_PATH", "C:\\Users\\User\\Downloads\\jarvis.html")
        self.alma_folder = os.path.join(self.vault_path, "ALMA Notes")
        os.makedirs(self.alma_folder, exist_ok=True)
        print(f"[OBSIDIAN] Cofre conectado em: {self.vault_path}")

    def write_note(self, title: str, content: str, tags: list = None):
        """Cria ou sobrescreve uma nota .md no Obsidian."""
        if not title:
            title = f"Nota_ALMA_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Sanitiza o nome do arquivo
        safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_title = safe_title.replace(' ', '_')
        filepath = os.path.join(self.alma_folder, f"{safe_title}.md")

        # Monta o frontmatter YAML (padrão Obsidian)
        tag_str = "\n".join([f"  - {t}" for t in (tags or ["alma-generated"])])
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        note_body = f"""---
title: {title}
date: {now_str}
tags:
{tag_str}
---

{content}
"""
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(note_body)

        print(f"[OBSIDIAN] ✅ Nota criada: {filepath}")
        return filepath

    def append_to_daily(self, content: str):
        """Adiciona conteúdo na nota de Daily Notes do dia atual."""
        today = datetime.now().strftime("%Y-%m-%d")
        daily_folder = os.path.join(self.vault_path, "Daily Notes")
        os.makedirs(daily_folder, exist_ok=True)
        filepath = os.path.join(daily_folder, f"{today}.md")

        timestamp = datetime.now().strftime("%H:%M")
        entry = f"\n### {timestamp} — ALMA\n{content}\n"

        with open(filepath, 'a', encoding='utf-8') as f:
            f.write(entry)

        print(f"[OBSIDIAN] 📅 Adicionado no Daily Notes de {today}")
        return filepath

    def read_note(self, title: str) -> str:
        """Lê o conteúdo de uma nota existente."""
        safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip().replace(' ', '_')
        filepath = os.path.join(self.alma_folder, f"{safe_title}.md")

        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        return f"[OBSIDIAN] Nota '{title}' não encontrada."
