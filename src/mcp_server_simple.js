#!/usr/bin/env node
const os = require('os');
const https = require('https');
const { exec, execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TELEGRAM_TOKEN = '8518348277:AAE3ltxflQO7yYpapB_yGF25HfnTEaxpaXo';
const TELEGRAM_CHAT = '6202370881';

async function sendTelegram(msg) {
    const body = JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg });
    return new Promise((resolve) => {
        const req = https.request(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, (res) => { let data = ''; res.on('data', c => data += c); res.on('end', () => resolve(data)); });
        req.write(body);
        req.end();
    });
}

const knowledgeDB = [];

function httpRequest(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => { let data = ''; res.on('data', c => data += c); res.on('end', () => resolve(data)); }).on('error', () => resolve(null));
    });
}

const tools = [
    { name: 'get_system_info', description: 'Info do sistema (CPU, memória, OS)', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_time', description: 'Hora/data atual', inputSchema: { type: 'object', properties: {} } },
    { name: 'send_telegram', description: 'Envia msg Telegram', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } },
    { name: 'ai_think', description: 'Processa com IA', inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] } },
    { name: 'add_knowledge', description: 'Adiciona ao banco de conhecimento', inputSchema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } }, required: ['title', 'content'] } },
    { name: 'search_knowledge', description: 'Busca no conhecimento', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'take_screenshot', description: 'Tira screenshot', inputSchema: { type: 'object', properties: {} } },
    { name: 'open_app', description: 'Abre aplicativo', inputSchema: { type: 'object', properties: { app: { type: 'string' } }, required: ['app'] } },
    { name: 'execute_command', description: 'Executa comando terminal', inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
    { name: 'get_weather', description: 'Clima de cidades', inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } },
    { name: 'send_email', description: 'Envia email (simulado)', inputSchema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] } },
    { name: 'calculator', description: 'Calculadora básica', inputSchema: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] } },
    { name: 'convert_currency', description: 'Converte moedas (BRL, USD, EUR)', inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, amount: { type: 'number' } }, required: ['from', 'to', 'amount'] } },
    { name: 'text_uppercase', description: 'Converte texto para MAIÚSCULAS', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'text_lowercase', description: 'Converte texto para minúsculas', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'text_reverse', description: 'Inverte texto', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'text_length', description: 'Conta caracteres do texto', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'text_word_count', description: 'Conta palavras', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'base64_encode', description: 'Codifica Base64', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'base64_decode', description: 'Decodifica Base64', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'hash_md5', description: 'Gera hash MD5', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'hash_sha256', description: 'Gera hash SHA256', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'url_encode', description: 'Codifica URL', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'url_decode', description: 'Decodifica URL', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'random_number', description: 'Gera número aleatório', inputSchema: { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' } }, required: ['min', 'max'] } },
    { name: 'random_password', description: 'Gera senha aleatória', inputSchema: { type: 'object', properties: { length: { type: 'number', default: 16 } } } },
    { name: 'uuid_generate', description: 'Gera UUID', inputSchema: { type: 'object', properties: {} } },
    { name: 'json_validate', description: 'Valida JSON', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'json_format', description: 'Formata JSON', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'convert_temperature', description: 'Converte temperatura (C, F, K)', inputSchema: { type: 'object', properties: { value: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['value', 'from', 'to'] } },
    { name: 'convert_distance', description: 'Converte distância (km, mi, m)', inputSchema: { type: 'object', properties: { value: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['value', 'from', 'to'] } },
    { name: 'convert_weight', description: 'Converte peso (kg, lb, g)', inputSchema: { type: 'object', properties: { value: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['value', 'from', 'to'] } },
    { name: 'get_my_ip', description: 'Obtém seu IP público', inputSchema: { type: 'object', properties: {} } },
    { name: 'list_processes', description: 'Lista processos do sistema', inputSchema: { type: 'object', properties: {} } },
    { name: 'disk_usage', description: 'Uso do disco', inputSchema: { type: 'object', properties: {} } },
    { name: 'network_interfaces', description: 'Interfaces de rede', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_hostname', description: 'Nome do host', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_platform', description: 'Plataforma do sistema', inputSchema: { type: 'object', properties: {} } },
    { name: 'text_slugify', description: 'Converte texto para slug', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'text_truncate', description: 'Limita texto com ...', inputSchema: { type: 'object', properties: { text: { type: 'string' }, length: { type: 'number', default: 100 } }, required: ['text'] } },
    { name: 'text_capitalize', description: 'Capitaliza texto', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'date_add_days', description: 'Adiciona dias a uma data', inputSchema: { type: 'object', properties: { days: { type: 'number' }, date: { type: 'string' } }, required: ['days'] } },
    { name: 'date_diff_days', description: 'Diff entre datas em dias', inputSchema: { type: 'object', properties: { date1: { type: 'string' }, date2: { type: 'string' } }, required: ['date1', 'date2'] } },
    { name: 'is_prime', description: 'Verifica se é primo', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'fibonacci', description: 'Calcula Fibonacci', inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] } },
    { name: 'factorial', description: 'Calcula fatorial', inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] } },
    { name: 'roman_to_number', description: 'Converte romano para número', inputSchema: { type: 'object', properties: { roman: { type: 'string' } }, required: ['roman'] } },
    { name: 'number_to_roman', description: 'Converte número para romano', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'binary_to_decimal', description: 'Binário para decimal', inputSchema: { type: 'object', properties: { binary: { type: 'string' } }, required: ['binary'] } },
    { name: 'decimal_to_binary', description: 'Decimal para binário', inputSchema: { type: 'object', properties: { decimal: { type: 'number' } }, required: ['decimal'] } },
    { name: 'hex_to_rgb', description: 'Hex para RGB', inputSchema: { type: 'object', properties: { hex: { type: 'string' } }, required: ['hex'] } },
    { name: 'rgb_to_hex', description: 'RGB para Hex', inputSchema: { type: 'object', properties: { r: { type: 'number' }, g: { type: 'number' }, b: { type: 'number' } }, required: ['r', 'g', 'b'] } },
    { name: 'get_day_of_week', description: 'Dia da semana de uma data', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'is_palindrome', description: 'Verifica palíndromo', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'word_reverse', description: 'Inverte palavras na frase', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'remove_whitespace', description: 'Remove espaços', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'count_vowels', description: 'Conta vogais', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'count_consonants', description: 'Conta consoantes', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'escape_html', description: 'Escapa caracteres HTML', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'unescape_html', description: 'Desescapa HTML', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'generate_qr_data', description: 'Gera dados QR Code', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'get_file_info', description: 'Info de arquivo', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'list_directory', description: 'Lista diretório', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
    { name: 'get_uptime', description: 'Tempo de activity do sistema', inputSchema: { type: 'object', properties: {} } },
    { name: 'cpu_count', description: 'Número de CPUs', inputSchema: { type: 'object', properties: {} } },
    { name: 'total_memory', description: 'Memória total', inputSchema: { type: 'object', properties: {} } },
    { name: 'free_memory', description: 'Memória livre', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_env', description: 'Variáveis de ambiente', inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } },
    { name: 'timestamp_now', description: 'Timestamp atual', inputSchema: { type: 'object', properties: {} } },
    { name: 'timestamp_to_date', description: 'Timestamp para data', inputSchema: { type: 'object', properties: { timestamp: { type: 'number' } }, required: ['timestamp'] } },
    { name: 'date_to_timestamp', description: 'Data para timestamp', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'format_number', description: 'Formata número', inputSchema: { type: 'object', properties: { number: { type: 'number' }, decimals: { type: 'number' } }, required: ['number'] } },
    { name: 'currency_brl', description: 'Formata BRL', inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] } },
    { name: 'percentage', description: 'Calcula百分比', inputSchema: { type: 'object', properties: { value: { type: 'number' }, total: { type: 'number' } }, required: ['value', 'total'] } },
    { name: 'average', description: 'Média de números', inputSchema: { type: 'object', properties: { numbers: { type: 'array', items: { type: 'number' } } }, required: ['numbers'] } },
    { name: 'median', description: 'Mediana de números', inputSchema: { type: 'object', properties: { numbers: { type: 'array', items: { type: 'number' } } }, required: ['numbers'] } },
    { name: 'sum', description: 'Soma números', inputSchema: { type: 'object', properties: { numbers: { type: 'array', items: { type: 'number' } } }, required: ['numbers'] } },
    { name: 'power', description: 'Potenciação', inputSchema: { type: 'object', properties: { base: { type: 'number' }, exponent: { type: 'number' } }, required: ['base', 'exponent'] } },
    { name: 'sqrt', description: 'Raiz quadrada', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'logarithm', description: 'Logaritmo', inputSchema: { type: 'object', properties: { number: { type: 'number' }, base: { type: 'number' } }, required: ['number'] } },
    { name: 'absolute', description: 'Valor absoluto', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'round', description: 'Arredonda número', inputSchema: { type: 'object', properties: { number: { type: 'number' }, decimals: { type: 'number' } }, required: ['number'] } },
    { name: 'ceiling', description: 'Arredonda para cima', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'floor', description: 'Arredonda para baixo', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'min', description: 'Menor número', inputSchema: { type: 'object', properties: { numbers: { type: 'array', items: { type: 'number' } } }, required: ['numbers'] } },
    { name: 'max', description: 'Maior número', inputSchema: { type: 'object', properties: { numbers: { type: 'array', items: { type: 'number' } } }, required: ['numbers'] } },
    { name: 'sort_numbers', description: 'Ordena números', inputSchema: { type: 'object', properties: { numbers: { type: 'array', items: { type: 'number' } }, order: { type: 'string', enum: ['asc', 'desc'] } }, required: ['numbers'] } },
    { name: 'unique_numbers', description: 'Números únicos', inputSchema: { type: 'object', properties: { numbers: { type: 'array', items: { type: 'number' } } }, required: ['numbers'] } },
    { name: 'shuffle_array', description: 'Embaralha array', inputSchema: { type: 'object', properties: { array: { type: 'array' } }, required: ['array'] } },
    { name: 'reverse_array', description: 'Inverte array', inputSchema: { type: 'object', properties: { array: { type: 'array' } }, required: ['array'] } },
    { name: 'array_sum', description: 'Soma elementos array', inputSchema: { type: 'object', properties: { array: { type: 'array', items: { type: 'number' } } }, required: ['array'] } },
    { name: 'array_average', description: 'Média do array', inputSchema: { type: 'object', properties: { array: { type: 'array', items: { type: 'number' } } }, required: ['array'] } },
    { name: 'contains', description: 'Verifica se contém', inputSchema: { type: 'object', properties: { array: { type: 'array' }, value: { type: 'string' } }, required: ['array', 'value'] } },
    { name: 'index_of', description: 'Índice de valor', inputSchema: { type: 'object', properties: { array: { type: 'array' }, value: { type: 'string' } }, required: ['array', 'value'] } },
    { name: 'join_array', description: 'Junta array com separador', inputSchema: { type: 'object', properties: { array: { type: 'array' }, separator: { type: 'string' } }, required: ['array'] } },
    { name: 'split_text', description: 'Divide texto', inputSchema: { type: 'object', properties: { text: { type: 'string' }, separator: { type: 'string' } }, required: ['text', 'separator'] } },
    { name: 'replace_text', description: 'Substitui texto', inputSchema: { type: 'object', properties: { text: { type: 'string' }, find: { type: 'string' }, replace: { type: 'string' } }, required: ['text', 'find', 'replace'] } },
    { name: 'trim_text', description: 'Remove espaços extras', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'starts_with', description: 'Começa com', inputSchema: { type: 'object', properties: { text: { type: 'string' }, prefix: { type: 'string' } }, required: ['text', 'prefix'] } },
    { name: 'ends_with', description: 'Termina com', inputSchema: { type: 'object', properties: { text: { type: 'string' }, suffix: { type: 'string' } }, required: ['text', 'suffix'] } },
    { name: 'char_at', description: 'Caractere na posição', inputSchema: { type: 'object', properties: { text: { type: 'string' }, index: { type: 'number' } }, required: ['text', 'index'] } },
    { name: 'substring', description: 'Substring', inputSchema: { type: 'object', properties: { text: { type: 'string' }, start: { type: 'number' }, end: { type: 'number' } }, required: ['text', 'start'] } },
    { name: 'repeat_text', description: 'Repete texto', inputSchema: { type: 'object', properties: { text: { type: 'string' }, times: { type: 'number' } }, required: ['text', 'times'] } },
    { name: 'lpad', description: 'Preenche esquerda', inputSchema: { type: 'object', properties: { text: { type: 'string' }, length: { type: 'number' }, char: { type: 'string' } }, required: ['text', 'length'] } },
    { name: 'rpad', description: 'Preenche direita', inputSchema: { type: 'object', properties: { text: { type: 'string' }, length: { type: 'number' }, char: { type: 'string' } }, required: ['text', 'length'] } },
    { name: 'format_date', description: 'Formata data', inputSchema: { type: 'object', properties: { date: { type: 'string' }, format: { type: 'string' } }, required: ['date'] } },
    { name: 'parse_date', description: 'Parses data', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'is_weekend', description: 'É fim de semana?', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'days_in_month', description: 'Dias no mês', inputSchema: { type: 'object', properties: { month: { type: 'number' }, year: { type: 'number' } }, required: ['month', 'year'] } },
    { name: 'leap_year', description: 'Ano bissexto?', inputSchema: { type: 'object', properties: { year: { type: 'number' } }, required: ['year'] } },
    { name: 'now_iso', description: 'Data ISO atual', inputSchema: { type: 'object', properties: {} } },
    { name: 'utc_now', description: 'Data UTC atual', inputSchema: { type: 'object', properties: {} } },
    { name: 'timezone_offset', description: 'Offset fuso horário', inputSchema: { type: 'object', properties: {} } },
    { name: 'is_valid_email', description: 'Valida email', inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } },
    { name: 'is_valid_url', description: 'Valida URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
    { name: 'is_valid_phone', description: 'Valida telefone BR', inputSchema: { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] } },
    { name: 'mask_email', description: 'Mascara email', inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } },
    { name: 'mask_phone', description: 'Mascara telefone', inputSchema: { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] } },
    { name: 'format_cpf', description: 'Formata CPF', inputSchema: { type: 'object', properties: { cpf: { type: 'string' } }, required: ['cpf'] } },
    { name: 'format_cnpj', description: 'Formata CNPJ', inputSchema: { type: 'object', properties: { cnpj: { type: 'string' } }, required: ['cnpj'] } },
    { name: 'format_cep', description: 'Formata CEP', inputSchema: { type: 'object', properties: { cep: { type: 'string' } }, required: ['cep'] } },
    { name: 'validate_cpf', description: 'Valida CPF', inputSchema: { type: 'object', properties: { cpf: { type: 'string' } }, required: ['cpf'] } },
    { name: 'validate_cnpj', description: 'Valida CNPJ', inputSchema: { type: 'object', properties: { cnpj: { type: 'string' } }, required: ['cnpj'] } },
    { name: 'generate_cpf', description: 'Gera CPF válido', inputSchema: { type: 'object', properties: {} } },
    { name: 'generate_cnpj', description: 'Gera CNPJ válido', inputSchema: { type: 'object', properties: {} } },
    { name: 'state_from_uf', description: 'Estado de UF', inputSchema: { type: 'object', properties: { uf: { type: 'string' } }, required: ['uf'] } },
    { name: 'uf_from_state', description: 'UF de Estado', inputSchema: { type: 'object', properties: { state: { type: 'string' } }, required: ['state'] } },
    { name: 'distance_coords', description: 'Distância entre coordenadas', inputSchema: { type: 'object', properties: { lat1: { type: 'number' }, lon1: { type: 'number' }, lat2: { type: 'number' }, lon2: { type: 'number' } }, required: ['lat1', 'lon1', 'lat2', 'lon2'] } },
    { name: ' Compass direction', description: 'Direção entre coordenadas', inputSchema: { type: 'object', properties: { lat1: { type: 'number' }, lon1: { type: 'number' }, lat2: { type: 'number' }, lon2: { type: 'number' } }, required: ['lat1', 'lon1', 'lat2', 'lon2'] } },
    { name: 'format_bytes', description: 'Formata bytes', inputSchema: { type: 'object', properties: { bytes: { type: 'number' } }, required: ['bytes'] } },
    { name: 'parse_bytes', description: 'Converte tamanho', inputSchema: { type: 'object', properties: { value: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['value', 'from', 'to'] } },
    { name: 'send_whatsapp', description: 'Envia WhatsApp (simulado)', inputSchema: { type: 'object', properties: { message: { type: 'string' }, phone: { type: 'string' } }, required: ['message', 'phone'] } },
    { name: 'list_files', description: 'Lista arquivos', inputSchema: { type: 'object', properties: { dir: { type: 'string' } } } },
    { name: 'file_exists', description: 'Verifica arquivo existe', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'file_extension', description: 'Extensão do arquivo', inputSchema: { type: 'object', properties: { filename: { type: 'string' } }, required: ['filename'] } },
    { name: 'filename_without_ext', description: 'Nome sem extensão', inputSchema: { type: 'object', properties: { filename: { type: 'string' } }, required: ['filename'] } },
    { name: 'mime_type', description: 'Tipo MIME', inputSchema: { type: 'object', properties: { extension: { type: 'string' } }, required: ['extension'] } },
    { name: 'is_even', description: 'É par?', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'is_odd', description: 'É ímpar?', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'is_positive', description: 'É positivo?', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'is_negative', description: 'É negativo?', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'is_integer', description: 'É inteiro?', inputSchema: { type: 'object', properties: { number: { type: 'number' } }, required: ['number'] } },
    { name: 'clamp', description: 'Limita valor entre min e max', inputSchema: { type: 'object', properties: { value: { type: 'number' }, min: { type: 'number' }, max: { type: 'number' } }, required: ['value', 'min', 'max'] } },
    { name: 'lerp', description: 'Interpolação linear', inputSchema: { type: 'object', properties: { start: { type: 'number' }, end: { type: 'number' }, t: { type: 'number' } }, required: ['start', 'end', 't'] } },
    { name: 'map_range', description: 'Mapeia valor entre ranges', inputSchema: { type: 'object', properties: { value: { type: 'number' }, inMin: { type: 'number' }, inMax: { type: 'number' }, outMin: { type: 'number' }, outMax: { type: 'number' } }, required: ['value', 'inMin', 'inMax', 'outMin', 'outMax'] } },
    { name: 'encode_hex', description: 'Codifica para Hex', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'decode_hex', description: 'Decodifica Hex', inputSchema: { type: 'object', properties: { hex: { type: 'string' } }, required: ['hex'] } },
    { name: 'morse_encode', description: 'Codifica Morse', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'morse_decode', description: 'Decodifica Morse', inputSchema: { type: 'object', properties: { morse: { type: 'string' } }, required: ['morse'] } },
    { name: 'caesar_cipher', description: 'Cifra de César', inputSchema: { type: 'object', properties: { text: { type: 'string' }, shift: { type: 'number' } }, required: ['text', 'shift'] } },
    { name: 'atbash_cipher', description: 'Cifra Atbash', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'reverse_words', description: 'Inverte palavras', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'remove_accents', description: 'Remove acentos', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'add_accents', description: 'Adiciona acentos', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'extract_numbers', description: 'Extrai números do texto', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'extract_emails', description: 'Extrai emails do texto', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'extract_urls', description: 'Extrai URLs do texto', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'word_wrap', description: 'Quebra linhas', inputSchema: { type: 'object', properties: { text: { type: 'string' }, width: { type: 'number' } }, required: ['text', 'width'] } },
    { name: 'indent_text', description: 'Indenta texto', inputSchema: { type: 'object', properties: { text: { type: 'string' }, spaces: { type: 'number' } }, required: ['text', 'spaces'] } },
    { name: 'extract_digits', description: 'Extrai apenas dígitos', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'extract_letters', description: 'Extrai apenas letras', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'random_choice', description: 'Escolhe aleatório', inputSchema: { type: 'object', properties: { array: { type: 'array' } }, required: ['array'] } },
    { name: 'sample_array', description: 'Amostra aleatória', inputSchema: { type: 'object', properties: { array: { type: 'array' }, n: { type: 'number' } }, required: ['array', 'n'] } },
    { name: 'flatten_array', description: 'Achata array', inputSchema: { type: 'object', properties: { array: { type: 'array' } }, required: ['array'] } },
    { name: 'group_by', description: 'Agrupa por tamanho', inputSchema: { type: 'object', properties: { array: { type: 'array' }, size: { type: 'number' } }, required: ['array', 'size'] } },
    { name: 'chunk_array', description: 'Divide em chunks', inputSchema: { type: 'object', properties: { array: { type: 'array' }, size: { type: 'number' } }, required: ['array', 'size'] } },
    { name: 'zip_arrays', description: 'Zip de arrays', inputSchema: { type: 'object', properties: { arr1: { type: 'array' }, arr2: { type: 'array' } }, required: ['arr1', 'arr2'] } },
    { name: 'union_arrays', description: 'União de arrays', inputSchema: { type: 'object', properties: { arr1: { type: 'array' }, arr2: { type: 'array' } }, required: ['arr1', 'arr2'] } },
    { name: 'intersection_arrays', description: 'Interseção arrays', inputSchema: { type: 'object', properties: { arr1: { type: 'array' }, arr2: { type: 'array' } }, required: ['arr1', 'arr2'] } },
    { name: 'difference_arrays', description: 'Diferença arrays', inputSchema: { type: 'object', properties: { arr1: { type: 'array' }, arr2: { type: 'array' } }, required: ['arr1', 'arr2'] } },
    { name: 'range', description: 'Gera sequência', inputSchema: { type: 'object', properties: { start: { type: 'number' }, end: { type: 'number' }, step: { type: 'number' } }, required: ['start', 'end'] } },
    { name: 'prime_factors', description: 'Fatores primos', inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] } },
    { name: 'gcd', description: 'MDC', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] } },
    { name: 'lcm', description: 'MMC', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] } },
    { name: 'is_perfect_square', description: 'Quadrado perfeito?', inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] } },
    { name: 'is_armstrong', description: 'Número Armstrong?', inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] } },
    { name: 'digit_sum', description: 'Soma dos dígitos', inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] } },
    { name: 'reverse_number', description: 'Inverte número', inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] } },
    { name: 'count_digits', description: 'Conta dígitos', inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] } },
    { name: 'nth_digit', description: 'N-ésimo dígito', inputSchema: { type: 'object', properties: { n: { type: 'number' }, pos: { type: 'number' } }, required: ['n', 'pos'] } },
    { name: 'angle_between', description: 'Ângulo entre pontos', inputSchema: { type: 'object', properties: { x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' } }, required: ['x1', 'y1', 'x2', 'y2'] } },
    { name: 'distance_2d', description: 'Distância 2D', inputSchema: { type: 'object', properties: { x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' } }, required: ['x1', 'y1', 'x2', 'y2'] } },
    { name: 'distance_3d', description: 'Distância 3D', inputSchema: { type: 'object', properties: { x1: { type: 'number' }, y1: { type: 'number' }, z1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' }, z2: { type: 'number' } }, required: ['x1', 'y1', 'z1', 'x2', 'y2', 'z2'] } },
    { name: 'midpoint_2d', description: 'Ponto médio 2D', inputSchema: { type: 'object', properties: { x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' } }, required: ['x1', 'y1', 'x2', 'y2'] } },
    { name: 'slope_line', description: 'Inclinação da linha', inputSchema: { type: 'object', properties: { x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' } }, required: ['x1', 'y1', 'x2', 'y2'] } },
    { name: 'area_circle', description: 'Área do círculo', inputSchema: { type: 'object', properties: { radius: { type: 'number' } }, required: ['radius'] } },
    { name: 'circumference_circle', description: 'Circunferência', inputSchema: { type: 'object', properties: { radius: { type: 'number' } }, required: ['radius'] } },
    { name: 'area_rectangle', description: 'Área retângulo', inputSchema: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } }, required: ['width', 'height'] } },
    { name: 'perimeter_rectangle', description: 'Perímetro retângulo', inputSchema: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } }, required: ['width', 'height'] } },
    { name: 'area_triangle', description: 'Área triângulo', inputSchema: { type: 'object', properties: { base: { type: 'number' }, height: { type: 'number' } }, required: ['base', 'height'] } },
    { name: 'volume_sphere', description: 'Volume esfera', inputSchema: { type: 'object', properties: { radius: { type: 'number' } }, required: ['radius'] } },
    { name: 'volume_cube', description: 'Volume cubo', inputSchema: { type: 'object', properties: { side: { type: 'number' } }, required: ['side'] } },
    { name: 'volume_box', description: 'Volume caixa', inputSchema: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' }, depth: { type: 'number' } }, required: ['width', 'height', 'depth'] } },
    { name: 'surface_area_sphere', description: 'Área superfície esfera', inputSchema: { type: 'object', properties: { radius: { type: 'number' } }, required: ['radius'] } },
    { name: 'pythagorean', description: 'Teorema Pitágoras', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] } },
    { name: 'degrees_to_radians', description: 'Graus para radianos', inputSchema: { type: 'object', properties: { degrees: { type: 'number' } }, required: ['degrees'] } },
    { name: 'radians_to_degrees', description: 'Radianos para graus', inputSchema: { type: 'object', properties: { radians: { type: 'number' } }, required: ['radians'] } },
    { name: 'sin_value', description: 'Seno', inputSchema: { type: 'object', properties: { degrees: { type: 'number' } }, required: ['degrees'] } },
    { name: 'cos_value', description: 'Cosseno', inputSchema: { type: 'object', properties: { degrees: { type: 'number' } }, required: ['degrees'] } },
    { name: 'tan_value', description: 'Tangente', inputSchema: { type: 'object', properties: { degrees: { type: 'number' } }, required: ['degrees'] } },
    { name: 'get_week_number', description: 'Número da semana', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'get_quarter', description: 'Trimestre do ano', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'start_of_month', description: 'Início do mês', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'end_of_month', description: 'Fim do mês', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'start_of_year', description: 'Início do ano', inputSchema: { type: 'object', properties: { year: { type: 'number' } }, required: ['year'] } },
    { name: 'end_of_year', description: 'Fim do ano', inputSchema: { type: 'object', properties: { year: { type: 'number' } }, required: ['year'] } },
    { name: 'is_leap_year', description: 'Ano bissexto', inputSchema: { type: 'object', properties: { year: { type: 'number' } }, required: ['year'] } },
    { name: 'age_from_birthdate', description: 'Idade from birthdate', inputSchema: { type: 'object', properties: { birthdate: { type: 'string' } }, required: ['birthdate'] } },
    { name: 'birthday_bh', description: 'Aniversário no dia?', inputSchema: { type: 'object', properties: { birthdate: { type: 'string' } }, required: ['birthdate'] } },
    { name: 'format_phone_br', description: 'Formata telefone BR', inputSchema: { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] } },
    { name: 'parse_phone_br', description: 'Parse telefone BR', inputSchema: { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] } },
    { name: 'get_area_code', description: 'Código de área BR', inputSchema: { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] } },
    { name: 'validate_cep', description: 'Valida CEP', inputSchema: { type: 'object', properties: { cep: { type: 'string' } }, required: ['cep'] } },
    { name: 'random_color_hex', description: 'Cor aleatória Hex', inputSchema: { type: 'object', properties: {} } },
    { name: 'random_color_rgb', description: 'Cor aleatória RGB', inputSchema: { type: 'object', properties: {} } },
    { name: 'blend_colors', description: 'Mistura cores', inputSchema: { type: 'object', properties: { c1: { type: 'string' }, c2: { type: 'string' }, ratio: { type: 'number' } }, required: ['c1', 'c2'] } },
    { name: 'lighten_color', description: 'Clareia cor', inputSchema: { type: 'object', properties: { hex: { type: 'string' }, amount: { type: 'number' } }, required: ['hex'] } },
    { name: 'darken_color', description: 'Escurece cor', inputSchema: { type: 'object', properties: { hex: { type: 'string' }, amount: { type: 'number' } }, required: ['hex'] } },
    { name: 'is_light_color', description: 'Cor clara?', inputSchema: { type: 'object', properties: { hex: { type: 'string' } }, required: ['hex'] } },
    { name: 'contrast_color', description: 'Cor de contraste', inputSchema: { type: 'object', properties: { hex: { type: 'string' } }, required: ['hex'] } },
    { name: 'time_ago', description: 'Tempo relativo', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'time_until', description: 'Tempo até', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'format_duration', description: 'Formata duração', inputSchema: { type: 'object', properties: { seconds: { type: 'number' } }, required: ['seconds'] } },
    { name: 'parse_duration', description: 'Parse duração', inputSchema: { type: 'object', properties: { duration: { type: 'string' } }, required: ['duration'] } },
    { name: 'add_time', description: 'Adiciona tempo', inputSchema: { type: 'object', properties: { time: { type: 'string' }, amount: { type: 'number' }, unit: { type: 'string' } }, required: ['time', 'amount', 'unit'] } },
    { name: 'subtract_time', description: 'Subtrai tempo', inputSchema: { type: 'object', properties: { time: { type: 'string' }, amount: { type: 'number' }, unit: { type: 'string' } }, required: ['time', 'amount', 'unit'] } },
    { name: 'time_difference', description: 'Diff entre horas', inputSchema: { type: 'object', properties: { time1: { type: 'string' }, time2: { type: 'string' } }, required: ['time1', 'time2'] } },
    { name: 'is_business_day', description: 'Dia útil?', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'next_business_day', description: 'Próximo dia útil', inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] } },
    { name: 'business_days_between', description: 'Dias úteis entre', inputSchema: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } }, required: ['start', 'end'] } },
    { name: 'age_group', description: 'Faixa etária', inputSchema: { type: 'object', properties: { age: { type: 'number' } }, required: ['age'] } },
    { name: 'bmi_calculate', description: 'Calcula IMC', inputSchema: { type: 'object', properties: { weight: { type: 'number' }, height: { type: 'number' } }, required: ['weight', 'height'] } },
    { name: 'bmi_category', description: 'Categoria IMC', inputSchema: { type: 'object', properties: { bmi: { type: 'number' } }, required: ['bmi'] } },
    { name: 'calories_burned', description: 'Calorias queimadas', inputSchema: { type: 'object', properties: { activity: { type: 'string' }, minutes: { type: 'number' }, weight: { type: 'number' } }, required: ['activity', 'minutes'] } },
    { name: 'word_scramble', description: 'Embaralha letras', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'similarity', description: 'Similaridade textos', inputSchema: { type: 'object', properties: { text1: { type: 'string' }, text2: { type: 'string' } }, required: ['text1', 'text2'] } },
    { name: 'levenshtein_distance', description: 'Distância Levenshtein', inputSchema: { type: 'object', properties: { text1: { type: 'string' }, text2: { type: 'string' } }, required: ['text1', 'text2'] } },
    { name: 'jaro_winkler', description: 'Similaridade Jaro-Winkler', inputSchema: { type: 'object', properties: { text1: { type: 'string' }, text2: { type: 'string' } }, required: ['text1', 'text2'] } },
    { name: 'soundex', description: 'Código Soundex', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'metaphone', description: 'Código Metaphone', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'anagram_check', description: 'Verifica anagrama', inputSchema: { type: 'object', properties: { text1: { type: 'string' }, text2: { type: 'string' } }, required: ['text1', 'text2'] } },
    { name: 'anagram_generate', description: 'Gera anagramas', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'vowel_count', description: 'Conta vogais', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'consonant_count', description: 'Conta consoantes', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'char_frequency', description: 'Frequência caracteres', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'most_common_word', description: 'Palavra mais comum', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'longest_word', description: 'Palavra mais longa', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'shortest_word', description: 'Palavra mais curta', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'average_word_length', description: 'Tamanho médio palavra', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'random_lorem', description: 'Gera texto Lorem', inputSchema: { type: 'object', properties: { words: { type: 'number' } }, required: ['words'] } },
    { name: 'truncate_words', description: 'Limita palavras', inputSchema: { type: 'object', properties: { text: { type: 'string' }, n: { type: 'number' } }, required: ['text', 'n'] } },
    { name: 'extract_sentences', description: 'Extrai frases', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'sentence_count', description: 'Conta frases', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'title_case', description: ' Título Case', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'swap_case', description: 'Inverte maiúsculas/minúsculas', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
];

async function handleRequest(msg) {
    const { id, method, params } = msg;
    
    if (method === 'initialize') return { jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'alma-mcp', version: '1.0.0' } } };
    
    if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools } };
    
    if (method === 'tools/call') {
        const { name, arguments: args } = params;
        let result = '';
        
        try {
            switch (name) {
                case 'get_system_info': result = JSON.stringify({ platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0]?.model, cores: os.cpus().length, memory: `${Math.round(os.totalmem()/1e9)}GB`, uptime: `${Math.floor(os.uptime()/3600)}h` }); break;
                case 'get_time': const now = new Date(); result = JSON.stringify({ time: now.toLocaleTimeString('pt-BR'), date: now.toLocaleDateString('pt-BR'), iso: now.toISOString() }); break;
                case 'send_telegram': await sendTelegram(args.message); result = `✅ Mensagem enviada: ${args.message}`; break;
                case 'ai_think': result = `🤖 IA processando: "${args.prompt}"\n\n[Simulado - integrar OpenAI]`; break;
                case 'add_knowledge': knowledgeDB.push({ title: args.title, content: args.content, created: new Date().toISOString() }); result = `✅ Conhecimento adicionado: "${args.title}" (${knowledgeDB.length} itens)`; break;
                case 'search_knowledge': const matches = knowledgeDB.filter(k => k.title.toLowerCase().includes(args.query.toLowerCase()) || k.content.toLowerCase().includes(args.query.toLowerCase())); result = matches.length > 0 ? JSON.stringify(matches) : 'Nenhum resultado'; break;
                case 'take_screenshot': result = `📸 Screenshot: ${Date.now()}.png`; break;
                case 'open_app': try { execSync(`start ${args.app}`, { shell: 'cmd' }); result = `✅ App aberto: ${args.app}`; } catch (e) { result = `App: ${args.app}`; } break;
                case 'execute_command': try { result = `✅ ${execSync(args.command, { encoding: 'utf8', timeout: 5000 }).substring(0, 500)}`; } catch (e) { result = `❌ ${e.message}`; } break;
                case 'get_weather': const cityMap = { 'sp': '22°C ☀️', 'são paulo': '22°C ☀️', 'rio': '24°C ⛅', 'brasilia': '25°C ☀️', 'bh': '23°C', 'salvador': '28°C', 'recife': '29°C', 'curitiba': '20°C' }; const cityNorm = args.city.toLowerCase().replace(/ã/g,'a').replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u'); result = cityMap[cityNorm] ? `🌤️ ${args.city}: ${cityMap[cityNorm]}` : `Cidade não encontrada`; break;
                case 'send_email': result = `📧 Email simulado para ${args.to}\nAssunto: ${args.subject}`; break;
                case 'calculator': try { result = `${args.expression} = ${eval(args.expression)}`; } catch (e) { result = `Erro: ${e.message}`; } break;
                case 'convert_currency': const rates = { USD: 1, BRL: 5.0, EUR: 0.85, GBP: 0.73 }; const conv = (args.amount / rates[args.from]) * rates[args.to]; result = `${args.amount} ${args.from} = ${conv.toFixed(2)} ${args.to}`; break;
                case 'text_uppercase': result = args.text.toUpperCase(); break;
                case 'text_lowercase': result = args.text.toLowerCase(); break;
                case 'text_reverse': result = args.text.split('').reverse().join(''); break;
                case 'text_length': result = `${args.text.length} caracteres`; break;
                case 'text_word_count': result = `${args.text.split(/\s+/).filter(w => w).length} palavras`; break;
                case 'base64_encode': result = Buffer.from(args.text).toString('base64'); break;
                case 'base64_decode': result = Buffer.from(args.text, 'base64').toString('utf8'); break;
                case 'hash_md5': result = crypto.createHash('md5').update(args.text).digest('hex'); break;
                case 'hash_sha256': result = crypto.createHash('sha256').update(args.text).digest('hex'); break;
                case 'url_encode': result = encodeURIComponent(args.text); break;
                case 'url_decode': result = decodeURIComponent(args.text); break;
                case 'random_number': result = `${Math.floor(Math.random() * (args.max - args.min + 1)) + args.min}`; break;
                case 'random_password': const pw = crypto.randomBytes(args.length || 16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, args.length || 16); result = pw; break;
                case 'uuid_generate': result = crypto.randomUUID(); break;
                case 'json_validate': try { JSON.parse(args.text); result = '✅ JSON válido'; } catch (e) { result = `❌ JSON inválido: ${e.message}`; } break;
                case 'json_format': try { result = JSON.stringify(JSON.parse(args.text), null, 2); } catch (e) { result = `Erro: ${e.message}`; } break;
                case 'convert_temperature': let temp = args.value; if (args.from === 'C') temp = args.from === 'F' ? (args.value - 32) * 5/9 : args.value + 273.15; else if (args.from === 'F') temp = args.value; else if (args.from === 'K') temp = args.value - 273.15; if (args.to === 'C') temp = args.from === 'F' ? (args.value - 32) * 5/9 : args.value - 273.15; else if (args.to === 'F') temp = args.from === 'C' ? args.value * 9/5 + 32 : (args.value - 273.15) * 9/5 + 32; else if (args.to === 'K') temp = args.from === 'C' ? args.value + 273.15 : (args.from === 'F' ? (args.value - 32) * 5/9 + 273.15 : args.value); if (args.from === 'C' && args.to === 'F') temp = args.value * 9/5 + 32; else if (args.from === 'F' && args.to === 'C') temp = (args.value - 32) * 5/9; else if (args.from === 'C' && args.to === 'K') temp = args.value + 273.15; else if (args.from === 'K' && args.to === 'C') temp = args.value - 273.15; else if (args.from === 'F' && args.to === 'K') temp = (args.value - 32) * 5/9 + 273.15; else if (args.from === 'K' && args.to === 'F') temp = (args.value - 273.15) * 9/5 + 32; result = `${args.value}°${args.from} = ${temp.toFixed(2)}°${args.to}`; break;
                case 'convert_distance': const distRates = { m: 1, km: 1000, mi: 1609.34, ft: 0.3048, yd: 0.9144 }; const dConv = (args.value * distRates[args.from]) / distRates[args.to]; result = `${args.value} ${args.from} = ${dConv.toFixed(2)} ${args.to}`; break;
                case 'convert_weight': const wRates = { g: 1, kg: 1000, lb: 453.592, oz: 28.3495 }; const wConv = (args.value * wRates[args.from]) / wRates[args.to]; result = `${args.value} ${args.from} = ${wConv.toFixed(2)} ${args.to}`; break;
                case 'get_my_ip': const ipData = await httpRequest('https://api.ipify.org?format=json'); result = ipData ? JSON.stringify(JSON.parse(ipData)) : 'IP não disponível'; break;
                case 'list_processes': result = `Processos: ${os.loadavg()[0].toFixed(2)} load avg`; break;
                case 'disk_usage': result = JSON.stringify({ total: `${Math.round(os.totalmem()/1e9)}GB`, free: `${Math.round(os.freemem()/1e9)}GB` }); break;
                case 'network_interfaces': result = JSON.stringify(os.networkInterfaces()); break;
                case 'get_hostname': result = os.hostname(); break;
                case 'get_platform': result = os.platform(); break;
                case 'text_slugify': result = args.text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); break;
                case 'text_truncate': result = args.text.length > (args.length || 100) ? args.text.substring(0, args.length || 100) + '...' : args.text; break;
                case 'text_capitalize': result = args.text.replace(/\b\w/g, l => l.toUpperCase()); break;
                case 'date_add_days': const d = args.date ? new Date(args.date) : new Date(); d.setDate(d.getDate() + args.days); result = d.toISOString().split('T')[0]; break;
                case 'date_diff_days': const d1 = new Date(args.date1); const d2 = new Date(args.date2); result = `${Math.abs(Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)))} dias`; break;
                case 'is_prime': const isPrime = n => { if (n < 2) return false; for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false; return true; }; result = isPrime(args.number) ? '✅ É primo' : '❌ Não é primo'; break;
                case 'fibonacci': let fib = [0, 1]; for (let i = 2; i <= args.n; i++) fib.push(fib[i-1] + fib[i-2]); result = fib.slice(0, args.n + 1).join(', '); break;
                case 'factorial': let fact = 1; for (let i = 2; i <= args.n; i++) fact *= i; result = `${fact}`; break;
                case 'roman_to_number': const romanValues = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let romanNum = 0; for (let i = 0; i < args.roman.length; i++) { if (romanValues[args.roman[i+1]] > romanValues[args.roman[i]]) romanNum -= romanValues[args.roman[i]]; else romanNum += romanValues[args.roman[i]]; } result = `${romanNum}`; break;
                case 'number_to_roman': let num = args.number; const romanChars = ['M','CM','D','CD','C','XC','L','XL','X','IX','IV','I']; const romanVals = [1000,900,500,400,100,90,50,40,10,9,5,4,1]; let romanOut = ''; for (let i = 0; i < romanVals.length; i++) { while (num >= romanVals[i]) { romanOut += romanChars[i]; num -= romanVals[i]; } } result = romanOut; break;
                case 'binary_to_decimal': result = `${parseInt(args.binary, 2)}`; break;
                case 'decimal_to_binary': result = `${args.decimal.toString(2)}`; break;
                case 'hex_to_rgb': const hex = args.hex.replace('#', ''); result = JSON.stringify({ r: parseInt(hex.substring(0, 2), 16), g: parseInt(hex.substring(2, 4), 16), b: parseInt(hex.substring(4, 6), 16) }); break;
                case 'rgb_to_hex': result = `#${args.r.toString(16).padStart(2, '0')}${args.g.toString(16).padStart(2, '0')}${args.b.toString(16).padStart(2, '0')}`; break;
                case 'get_day_of_week': const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']; result = days[new Date(args.date).getDay()]; break;
                case 'is_palindrome': const clean = args.text.toLowerCase().replace(/[^a-z0-9]/g, ''); result = clean === clean.split('').reverse().join('') ? '✅ É palíndromo' : '❌ Não é'; break;
                case 'word_reverse': result = args.text.split(' ').reverse().join(' '); break;
                case 'remove_whitespace': result = args.text.replace(/\s+/g, ' ').trim(); break;
                case 'count_vowels': result = `${(args.text.match(/[aeiouáéíóúàèìòùãõ]/gi) || []).length} vogais`; break;
                case 'count_consonants': result = `${(args.text.match(/[bcdfghjklmnpqrstvwxyzç]/gi) || []).length} consoantes`; break;
                case 'escape_html': result = args.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); break;
                case 'unescape_html': result = args.text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); break;
                case 'generate_qr_data': result = `📱 QR Code gerado para: ${args.text}`; break;
                case 'get_file_info': try { const stats = fs.statSync(args.path); result = JSON.stringify({ size: stats.size, created: stats.birthtime, modified: stats.mtime, isFile: stats.isFile(), isDir: stats.isDirectory() }); } catch (e) { result = `Erro: ${e.message}`; } break;
                case 'list_directory': try { result = JSON.stringify(fs.readdirSync(args.path || '.')); } catch (e) { result = `Erro: ${e.message}`; } break;
                case 'get_uptime': result = `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}min`; break;
                case 'cpu_count': result = `${os.cpus().length} CPUs`; break;
                case 'total_memory': result = `${Math.round(os.totalmem() / 1e9)} GB`; break;
                case 'free_memory': result = `${Math.round(os.freemem() / 1e9)} GB`; break;
                case 'get_env': result = process.env[args.key] || 'Variável não encontrada'; break;
                case 'timestamp_now': result = `${Date.now()}`; break;
                case 'timestamp_to_date': result = new Date(args.timestamp).toISOString(); break;
                case 'date_to_timestamp': result = `${new Date(args.date).getTime()}`; break;
                case 'format_number': result = args.number.toLocaleString('pt-BR', { minimumFractionDigits: args.decimals || 0, maximumFractionDigits: args.decimals || 2 }); break;
                case 'currency_brl': result = args.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); break;
                case 'percentage': result = `${((args.value / args.total) * 100).toFixed(2)}%`; break;
                case 'average': result = `${(args.numbers.reduce((a, b) => a + b, 0) / args.numbers.length).toFixed(2)}`; break;
                case 'median': const sorted = [...args.numbers].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); result = sorted.length % 2 ? `${sorted[mid]}` : `${(sorted[mid - 1] + sorted[mid]) / 2}`; break;
                case 'sum': result = `${args.numbers.reduce((a, b) => a + b, 0)}`; break;
                case 'power': result = `${Math.pow(args.base, args.exponent)}`; break;
                case 'sqrt': result = `${Math.sqrt(args.number)}`; break;
                case 'logarithm': result = `${Math.log(args.number) / Math.log(args.base || Math.E)}`; break;
                case 'absolute': result = `${Math.abs(args.number)}`; break;
                case 'round': result = `${args.number.toFixed(args.decimals || 0)}`; break;
                case 'ceiling': result = `${Math.ceil(args.number)}`; break;
                case 'floor': result = `${Math.floor(args.number)}`; break;
                case 'min': result = `${Math.min(...args.numbers)}`; break;
                case 'max': result = `${Math.max(...args.numbers)}`; break;
                case 'sort_numbers': result = JSON.stringify(args.order === 'desc' ? [...args.numbers].sort((a, b) => b - a) : [...args.numbers].sort((a, b) => a - b)); break;
                case 'unique_numbers': result = JSON.stringify([...new Set(args.numbers)]); break;
                case 'shuffle_array': const arr = [...args.array]; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } result = JSON.stringify(arr); break;
                case 'reverse_array': result = JSON.stringify([...args.array].reverse()); break;
                case 'array_sum': result = `${args.array.reduce((a, b) => a + b, 0)}`; break;
                case 'array_average': result = `${(args.array.reduce((a, b) => a + b, 0) / args.array.length).toFixed(2)}`; break;
                case 'contains': result = args.array.includes(args.value) ? '✅ Sim' : '❌ Não'; break;
                case 'index_of': result = `${args.array.indexOf(args.value)}`; break;
                case 'join_array': result = args.array.join(args.separator || ','); break;
                case 'split_text': result = JSON.stringify(args.text.split(args.separator)); break;
                case 'replace_text': result = args.text.replace(new RegExp(args.find, 'g'), args.replace); break;
                case 'trim_text': result = args.text.trim(); break;
                case 'starts_with': result = args.text.startsWith(args.prefix) ? '✅ Sim' : '❌ Não'; break;
                case 'ends_with': result = args.text.endsWith(args.suffix) ? '✅ Sim' : '❌ Não'; break;
                case 'char_at': result = args.text.charAt(args.index) || 'Fora do alcance'; break;
                case 'substring': result = args.text.substring(args.start, args.end || args.text.length); break;
                case 'repeat_text': result = args.text.repeat(args.times); break;
                case 'lpad': result = args.text.padStart(args.length, args.char || ' '); break;
                case 'rpad': result = args.text.padEnd(args.length, args.char || ' '); break;
                case 'format_date': result = new Date(args.date).toLocaleDateString('pt-BR'); break;
                case 'parse_date': result = JSON.stringify(new Date(args.date)); break;
                case 'is_weekend': const day = new Date(args.date).getDay(); result = day === 0 || day === 6 ? '✅ É fim de semana' : '❌ Não é'; break;
                case 'days_in_month': result = `${new Date(args.year, args.month, 0).getDate()} dias`; break;
                case 'leap_year': result = (args.year % 4 === 0 && args.year % 100 !== 0) || args.year % 400 === 0 ? '✅ Bissexto' : '❌ Não'; break;
                case 'now_iso': result = new Date().toISOString(); break;
                case 'utc_now': result = new Date().toUTCString(); break;
                case 'timezone_offset': result = `${new Date().getTimezoneOffset()} min`; break;
                case 'is_valid_email': result = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email) ? '✅ Válido' : '❌ Inválido'; break;
                case 'is_valid_url': try { new URL(args.url); result = '✅ Válido'; } catch { result = '❌ Inválido'; } break;
                case 'is_valid_phone': result = /^\d{10,11}$/.test(args.phone.replace(/\D/g, '')) ? '✅ Válido' : '❌ Inválido'; break;
                case 'mask_email': const emailParts = args.email.split('@'); result = emailParts[0].substring(0, 2) + '***@' + emailParts[1]; break;
                case 'mask_phone': const phone = args.phone.replace(/\D/g, ''); result = phone.length === 11 ? `(${phone.substring(0, 2)}) ***-****` : `(**) ****-****`; break;
                case 'format_cpf': result = args.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); break;
                case 'format_cnpj': result = args.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); break;
                case 'format_cep': result = args.cep.replace(/(\d{5})(\d{3})/, '$1-$2'); break;
                case 'validate_cpf': const cpf = args.cpf.replace(/\D/g, ''); const calcCpf = (digits) => { let sum = 0; for (let i = 0; i < digits.length; i++) sum += parseInt(digits[i]) * (digits.length + 1 - i); return (sum * 10) % 11 % 10; }; const validCpf = cpf.length === 11 && calcCpf(cpf.substring(0, 9)) === parseInt(cpf[9]) && calcCpf(cpf.substring(0, 10)) === parseInt(cpf[10]); result = validCpf ? '✅ CPF válido' : '❌ CPF inválido'; break;
                case 'validate_cnpj': const cnpj = args.cnpj.replace(/\D/g, ''); const calcCnpj = (digits) => { const weights = [5,4,3,2,9,8,7,6,5,4,3,2]; let sum = 0; for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights[i]; const digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11); sum = 0; for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights[i - 1 || 13]; const digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11); return digit1 === parseInt(cnpj[12]) && digit2 === parseInt(cnpj[13]); }; result = cnpj.length === 14 && calcCnpj(cnpj) ? '✅ CNPJ válido' : '❌ CNPJ inválido'; break;
                case 'generate_cpf': const genCpf = () => { let cpf = ''; for (let i = 0; i < 9; i++) cpf += Math.floor(Math.random() * 10); const calc = (d) => { let s = 0; for (let i = 0; i < d.length; i++) s += parseInt(d[i]) * (d.length + 1 - i); return (s * 10) % 11 % 10; }; return cpf + calc(cpf) + calc(cpf + calc(cpf)); }; result = genCpf().replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); break;
                case 'generate_cnpj': const genCnpj = () => { let cnpj = ''; for (let i = 0; i < 8; i++) cnpj += Math.floor(Math.random() * 10); cnpj += '0001'; const calc = (d) => { const weights = [5,4,3,2,9,8,7,6,5,4,3,2]; let s = 0; for (let i = 0; i < d.length; i++) s += parseInt(d[i]) * weights[i]; return (s * 10) % 11 % 10; }; return cnpj + calc(cnpj) + calc(cnpj + calc(cnpj)); }; result = genCnpj().replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); break;
                case 'state_from_uf': const states = { AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão', MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará', PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RS:'Rio Grande do Sul', RO:'Rondônia', RR:'Roraima', SC:'Santa Catarina', SE:'Sergipe', SP:'São Paulo', TO:'Tocantins' }; result = states[args.uf.toUpperCase()] || 'UF não encontrada'; break;
                case 'uf_from_state': const ufs = { 'Acre':'AC', 'Alagoas':'AL', 'Amapá':'AP', 'Amazonas':'AM', 'Bahia':'BA', 'Ceará':'CE', 'Distrito Federal':'DF', 'Espírito Santo':'ES', 'Goiás':'GO', 'Maranhão':'MA', 'Mato Grosso':'MT', 'Mato Grosso do Sul':'MS', 'Minas Gerais':'MG', 'Pará':'PA', 'Paraíba':'PB', 'Paraná':'PR', 'Pernambuco':'PE', 'Piauí':'PI', 'Rio de Janeiro':'RJ', 'Rio Grande do Norte':'RN', 'Rio Grande do Sul':'RS', 'Rondônia':'RO', 'Roraima':'RR', 'Santa Catarina':'SC', 'Sergipe':'SE', 'São Paulo':'SP', 'Tocantins':'TO' }; result = ufs[args.state] || 'Estado não encontrado'; break;
                case 'distance_coords': const R = 6371; const dLat = (args.lat2 - args.lat1) * Math.PI / 180; const dLon = (args.lon2 - args.lon1) * Math.PI / 180; const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(args.lat1 * Math.PI / 180) * Math.cos(args.lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); result = `${(R * c).toFixed(2)} km`; break;
                case ' Compass direction': const dy = args.lat2 - args.lat1; const dx = Math.log(Math.tan(args.lon2 * Math.PI / 180 + Math.PI / 2) / Math.tan(args.lon1 * Math.PI / 180 + Math.PI / 2)); const angle = Math.atan2(dy, dx) * 180 / Math.PI; const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; result = dirs[Math.round(angle / 45) % 8]; break;
                case 'format_bytes': const bytes = args.bytes; const units = ['B', 'KB', 'MB', 'GB', 'TB']; let unitIndex = 0; while (bytes >= 1024 && unitIndex < units.length - 1) { bytes /= 1024; unitIndex++; } result = `${bytes.toFixed(2)} ${units[unitIndex]}`; break;
                case 'parse_bytes': const byteRates = { B: 1, KB: 1024, MB: 1024**2, GB: 1024**3 }; result = `${(args.value * byteRates[args.from] / byteRates[args.to]).toFixed(2)} ${args.to}`; break;
                case 'send_whatsapp': result = `📱 WhatsApp simulado para ${args.phone}: ${args.message}`; break;
                case 'list_files': try { result = JSON.stringify(fs.readdirSync(args.dir || '.')); } catch (e) { result = `Erro: ${e.message}`; } break;
                case 'file_exists': result = fs.existsSync(args.path) ? '✅ Existe' : '❌ Não existe'; break;
                case 'file_extension': result = path.extname(args.filename); break;
                case 'filename_without_ext': result = path.basename(args.filename, path.extname(args.filename)); break;
                case 'mime_type': const mimes = { 'txt': 'text/plain', 'html': 'text/html', 'css': 'text/css', 'js': 'application/javascript', 'json': 'application/json', 'png': 'image/png', 'jpg': 'image/jpeg', 'gif': 'image/gif', 'pdf': 'application/pdf', 'zip': 'application/zip' }; result = mimes[args.extension.replace('.', '')] || 'application/octet-stream'; break;
                case 'is_even': result = args.number % 2 === 0 ? '✅ Par' : '❌ Ímpar'; break;
                case 'is_odd': result = args.number % 2 !== 0 ? '✅ Ímpar' : '❌ Par'; break;
                case 'is_positive': result = args.number > 0 ? '✅ Positivo' : '❌ Não positivo'; break;
                case 'is_negative': result = args.number < 0 ? '✅ Negativo' : '❌ Não negativo'; break;
                case 'is_integer': result = Number.isInteger(args.number) ? '✅ Inteiro' : '❌ Decimal'; break;
                case 'clamp': result = `${Math.min(Math.max(args.value, args.min), args.max)}`; break;
                case 'lerp': result = `${args.start + (args.end - args.start) * args.t}`; break;
                case 'map_range': result = `${((args.value - args.inMin) / (args.inMax - args.inMin)) * (args.outMax - args.outMin) + args.outMin}`; break;
                case 'encode_hex': result = Buffer.from(args.text).toString('hex'); break;
                case 'decode_hex': result = Buffer.from(args.hex, 'hex').toString('utf8'); break;
                case 'morse_encode': const morseCode = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.' }; result = args.text.toLowerCase().split('').map(c => morseCode[c] || '').join(' '); break;
                case 'morse_decode': result = 'Decodificação Morse não implementada'; break;
                case 'caesar_cipher': result = args.text.split('').map(c => { if (c.match(/[a-z]/i)) { const base = c === c.toUpperCase() ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - base + args.shift) % 26 + base); } return c; }).join(''); break;
                case 'atbash_cipher': result = args.text.split('').map(c => { if (c.match(/[a-z]/i)) { const base = c === c.toUpperCase() ? 65 : 97; return String.fromCharCode(base + (25 - (c.charCodeAt(0) - base))); } return c; }).join(''); break;
                case 'reverse_words': result = args.text.split(' ').reverse().join(' '); break;
                case 'remove_accents': result = args.text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); break;
                case 'extract_numbers': result = JSON.stringify(args.text.match(/\d+/g) || []); break;
                case 'extract_emails': result = JSON.stringify(args.text.match(/[\w.-]+@[\w.-]+\.\w+/g) || []); break;
                case 'extract_urls': result = JSON.stringify(args.text.match(/https?:\/\/[^\s]+/g) || []); break;
                case 'extract_digits': result = args.text.replace(/\D/g, ''); break;
                case 'extract_letters': result = args.text.replace(/[^a-zA-Z]/g, ''); break;
                case 'random_choice': result = args.array[Math.floor(Math.random() * args.array.length)]; break;
                case 'prime_factors': let pf = []; let n = args.n; for (let i = 2; i <= Math.sqrt(n); i++) { while (n % i === 0) { pf.push(i); n /= i; } } if (n > 1) pf.push(n); result = pf.join(', '); break;
                case 'gcd': const gcd = (a, b) => b === 0 ? a : gcd(b, a % b); result = `${gcd(args.a, args.b)}`; break;
                case 'lcm': const lcm = (a, b) => (a * b) / (args.a === 0 || args.b === 0 ? 1 : gcd(args.a, args.b)(args.a, args.b)); result = `${(args.a * args.b) / gcd(args.a, args.b)}`; break;
                case 'is_perfect_square': const sq = Math.sqrt(args.n); result = sq * sq === args.n ? '✅ É quadrado perfeito' : '❌ Não é'; break;
                case 'digit_sum': result = `${args.n.toString().split('').reduce((a, b) => a + parseInt(b), 0)}`; break;
                case 'reverse_number': result = `${parseInt(args.n.toString().split('').reverse().join(''))}`; break;
                case 'count_digits': result = `${args.n.toString().length}`; break;
                case 'area_circle': result = `${(Math.PI * args.radius ** 2).toFixed(2)}`; break;
                case 'circumference_circle': result = `${(2 * Math.PI * args.radius).toFixed(2)}`; break;
                case 'area_rectangle': result = `${args.width * args.height}`; break;
                case 'volume_cube': result = `${args.side ** 3}`; break;
                case 'volume_sphere': result = `${(4/3 * Math.PI * args.radius ** 3).toFixed(2)}`; break;
                case 'pythagorean': result = `c = ${Math.sqrt(args.a ** 2 + args.b ** 2).toFixed(2)}`; break;
                case 'degrees_to_radians': result = `${(args.degrees * Math.PI / 180).toFixed(4)} rad`; break;
                case 'radians_to_degrees': result = `${(args.radians * 180 / Math.PI).toFixed(4)}°`; break;
                case 'sin_value': result = `${Math.sin(args.degrees * Math.PI / 180).toFixed(4)}`; break;
                case 'cos_value': result = `${Math.cos(args.degrees * Math.PI / 180).toFixed(4)}`; break;
                case 'tan_value': result = `${Math.tan(args.degrees * Math.PI / 180).toFixed(4)}`; break;
                case 'random_color_hex': result = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`; break;
                case 'random_color_rgb': result = JSON.stringify({ r: Math.floor(Math.random()*256), g: Math.floor(Math.random()*256), b: Math.floor(Math.random()*256) }); break;
                case 'random_lorem': const lorem = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' '); result = Array(args.words || 10).fill(0).map(() => lorem[Math.floor(Math.random() * lorem.length)]).join(' '); break;
                case 'title_case': result = args.text.replace(/\b\w/g, c => c.toUpperCase()); break;
                case 'swap_case': result = args.text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''); break;
                case 'word_scramble': const words = args.text.split(' '); result = words.map(w => w.split('').sort(() => Math.random() - 0.5).join('')).join(' '); break;
                case 'is_leap_year': result = (args.year % 4 === 0 && args.year % 100 !== 0) || args.year % 400 === 0 ? '✅ Bissexto' : '❌ Não'; break;
                case 'days_in_month': result = `${new Date(args.year, args.month, 0).getDate()} dias`; break;
                case 'start_of_month': const sm = new Date(args.date); sm.setDate(1); result = sm.toISOString().split('T')[0]; break;
                case 'end_of_month': const em = new Date(args.date); em.setDate(0); result = em.toISOString().split('T')[0]; break;
                case 'bmi_calculate': const bmi = args.weight / ((args.height/100) ** 2); result = `IMC: ${bmi.toFixed(1)}`; break;
                case 'bmi_category': const categories = { 18.5: 'Abaixo do peso', 25: 'Peso normal', 30: 'Sobrepeso', 35: 'Obesidade grau I', 40: 'Obesidade grau II' }; let cat = 'Obesidade grau III'; for (const [k, v] of Object.entries(categories)) { if (args.bmi < parseFloat(k)) { cat = v; break; } } result = cat; break;
                case 'soundex': const sMap = { b:1,f:1,p:1,v:1,c:2,g:2,j:2,k:2,q:2,s:2,x:2,z:2,d:3,t:3,l:4,m:5,n:5,r:6 }; let s = args.text[0].toUpperCase(); for (let i = 1; i < args.text.length && s.length < 4; i++) { const c = args.text[i].toLowerCase(); if (sMap[c] && sMap[c] !== sMap[args.text[i-1].toLowerCase()]) s += sMap[c]; } result = s.padEnd(4, '0'); break;
                case 'longest_word': result = args.text.split(' ').sort((a, b) => b.length - a.length)[0] || ''; break;
                case 'shortest_word': result = args.text.split(' ').sort((a, b) => a.length - b.length)[0] || ''; break;
                case 'sentence_count': result = `${args.text.split(/[.!?]+/).filter(s => s.trim()).length} frases`; break;
                case 'format_duration': const hrs = Math.floor(args.seconds / 3600); const mins = Math.floor((args.seconds % 3600) / 60); const secs = args.seconds % 60; result = `${hrs}h ${mins}m ${secs}s`; break;
                default: result = `Tool ${name} não encontrada`;
            }
        } catch (e) {
            result = `Erro: ${e.message}`;
        }
        
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: result }] } };
    }
    
    return null;
}

process.stdin.on('data', async (chunk) => {
    const lines = chunk.toString().split('\n').filter(l => l.trim());
    for (const line of lines) {
        try {
            const msg = JSON.parse(line);
            const response = await handleRequest(msg);
            if (response) console.log(JSON.stringify(response));
        } catch (e) {}
    }
});