import os
from playwright.sync_api import sync_playwright

# Detecta se está em modo nuvem
IS_CLOUD = os.getenv("CLOUD_MODE", "false").lower() == "true"

class AthenaAgent:
    def __init__(self):
        self.pw = None
        self.browser = None
        self.context = None
        self.page = None

    def start(self):
        self.pw = sync_playwright().start()
        # Na nuvem rodamos sempre em headless. No local, opcional.
        headless_mode = True if IS_CLOUD else False
        self.browser = self.pw.chromium.launch(headless=headless_mode)
        self.context = self.browser.new_context()
        self.page = self.context.new_page()
        print(f"[ATHENA] Sistema de pesquisa {'[HEADLESS]' if headless_mode else '[VISUAL]'} inicializado.")

    def navigate_to(self, url):
        if self.page:
            print(f"[ATHENA] Navegando para {url}")
            self.page.goto(url)
            return True
        return False

    def search_and_extract(self, query):
        if self.page:
            print(f"[ATHENA] Pesquisando: {query}")
            self.page.goto(f"https://www.google.com/search?q={query}")
            # Tentar extrair o snippet principal do Google (VwiC3b é um seletor comum)
            try:
                content = self.page.locator("div.VwiC3b").first.text_content()
                return content
            except:
                return "Não consegui extrair detalhes, mas a página foi carregada."
        return "Erro ao acessar a rede neural global."

    def stop(self):
        if self.browser:
            self.browser.close()
            self.pw.stop()

if __name__ == "__main__":
    agent = AthenaAgent()
    agent.start()
    info = agent.search_and_extract("Preço do Bitcoin hoje")
    print(f"Informação encontrada: {info}")
    agent.stop()
