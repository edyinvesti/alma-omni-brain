class ActionParser {
    constructor() {
        // ✅ NOV0: Múltiplos patterns para ser mais tolerante
        this.patterns = [
            /\[\[ACTION:\s*\{([^}]+)\}\s*\]\]/gi,
            /\[\[ACTION\s*::\s*(.+?)\]\]/gi,
            /<ACTION\s*:\s*(.+?)\/ACTION>/gi,
            /\{action:\s*"([^"]+)"\}/gi,
            /@action\s+(\w+)(?:\s+(.+))?/gi
        ];
    }

    // ✅ NOV0: Parse robusto de actions
    parse(text) {
        const actions = [];
        
        if (!text || typeof text !== 'string') {
            return actions;
        }

        // Tentar cada pattern
        for (const pattern of this.patterns) {
            const matches = text.matchAll(new RegExp(pattern.source, pattern.flags));
            
            for (const match of matches) {
                try {
                    const action = this.parseMatch(match);
                    if (action) {
                        actions.push(action);
                    }
                } catch (e) {
                    console.log(`[PARSE] Erro ao processar match: ${e.message}`);
                }
            }
        }

        // Se nenhum pattern funcionou, tenta extrair de forma inteligente
        if (actions.length === 0) {
            const smartAction = this.smartParse(text);
            if (smartAction) {
                actions.push(smartAction);
            }
        }

        // ✅ NOV0: Limpa o texto original das tags de action
        const cleanedText = this.cleanText(text, actions);
        
        return { actions, cleanedText };
    }

    parseMatch(match) {
        const fullMatch = match[0];
        
        // Pattern 1: [[ACTION: { type: "open_app", target: "chrome" }]]
        if (fullMatch.includes('{')) {
            try {
                // Extrai o JSON dentro do match
                const jsonMatch = fullMatch.match(/\{[^}]+\}/);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    return { type: data.type, target: data.target, raw: fullMatch };
                }
            } catch (e) {
                // Parse manual
                const typeMatch = fullMatch.match(/type:\s*"([^"]+)"/i);
                const targetMatch = fullMatch.match(/target:\s*"([^"]+)"/i);
                
                if (typeMatch) {
                    return { 
                        type: typeMatch[1], 
                        target: targetMatch ? targetMatch[1] : '',
                        raw: fullMatch 
                    };
                }
            }
        }

        // Pattern 2: [[ACTION:: open_app chrome]]
        if (match[1] && match[1].includes(' ')) {
            const parts = match[1].trim().split(/\s+/);
            return { type: parts[0], target: parts.slice(1).join(' '), raw: fullMatch };
        }

        return { type: 'unknown', target: '', raw: fullMatch };
    }

    // ✅ NOV0: Parse inteligente quando regex falha
    smartParse(text) {
        const lower = text.toLowerCase();
        
        // Palavras-chave que indicam ações
        const keywords = {
            'abre': 'open_app',
            'abra': 'open_app',
            'abrir': 'open_app',
            'abra o': 'open_app',
            'abre o': 'open_app',
            'vá para': 'open_url',
            'va para': 'open_url',
            'pesquise': 'search',
            'pesquisa': 'search',
            'busque': 'search',
            'procura': 'search',
            'execute': 'command',
            'rode': 'command',
            'rode isso': 'command'
        };

        for (const [key, type] of Object.entries(keywords)) {
            if (lower.includes(key)) {
                const target = text.replace(new RegExp(key, 'i'), '').trim();
                return { type, target, smart: true };
            }
        }

        return null;
    }

    // ✅ NOV0: Limpa as action tags do texto
    cleanText(text, actions) {
        let cleaned = text;
        
        for (const action of actions) {
            if (action.raw) {
                cleaned = cleaned.replace(action.raw, '');
            }
        }

        // Limpa espaços extras
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        // Remove marcadores persistentes
        cleaned = cleaned.replace(/\[\[ACTION[^\]]*\]\]/gi, '');
        cleaned = cleaned.replace(/<ACTION[^>]*>/gi, '');
        
        return cleaned;
    }

    // ✅ NOV0: Valida se o tipo de ação é válido
    isValidAction(action) {
        const validTypes = [
            'open_app', 'open_url', 'search', 'command',
            'type_text', 'click', 'screenshot', 'volume',
            'work_mode', 'cleanup', 'play_media', 'pause_media'
        ];
        
        return validTypes.includes(action.type);
    }
}

module.exports = new ActionParser();