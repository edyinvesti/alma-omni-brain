FROM node:20-bullseye-slim

# Instalar Python, pip e utilitários
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv git gcc g++ make && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Criar ambiente virtual Python
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Instalar dependências do Node
COPY package*.json ./
RUN npm install --production

# Instalar dependências Python (se houver, usamos o path do alma)
COPY alma/requirements.txt ./alma/
RUN pip install --no-cache-dir -r alma/requirements.txt

# Copiar o resto do projeto
COPY . .

# Expor ambas as portas (Fly.io roteará a principal, mas ambas ficam disponíveis)
EXPOSE 3000
EXPOSE 3001

# Variável de ambiente global caso o app precise
ENV CLOUD_MODE="true"
ENV PORT="3000"

# Iniciar o Orquestrador Central via alma_daemon.js (configurado no npm start)
CMD ["npm", "start"]
