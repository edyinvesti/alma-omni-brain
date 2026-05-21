const fs = require('fs');
const path = require('path');

class CompanyManager {
    constructor() {
        this.companiesFile = path.resolve(__dirname, '../data/companies.json');
        this.companies = {};
        this.activeCompanyId = 'iamobil'; // Default fallback
        this.loadCompanies();
    }

    loadCompanies() {
        try {
            if (fs.existsSync(this.companiesFile)) {
                const data = fs.readFileSync(this.companiesFile, 'utf8');
                this.companies = JSON.parse(data);
                
                // Normalizar case id se necessário
                const keys = Object.keys(this.companies);
                if (keys.length > 0 && !this.companies[this.activeCompanyId]) {
                    this.activeCompanyId = keys[0];
                }
            } else {
                console.warn('[COMPANY MANAGER] data/companies.json não encontrado!');
            }
        } catch (e) {
            console.error('[COMPANY MANAGER] Erro ao carregar companies.json:', e.message);
        }
    }

    listAll() {
        return Object.keys(this.companies).map(id => ({
            id,
            name: this.companies[id].name
        }));
    }

    switchTo(companyId) {
        const normalizedId = companyId.toLowerCase().trim();
        if (this.companies[normalizedId]) {
            this.activeCompanyId = normalizedId;
            console.log(`[COMPANY MANAGER] Contexto alterado para a empresa: ${this.companies[normalizedId].name} (${normalizedId})`);
            return true;
        }
        return false;
    }

    getActiveId() {
        return this.activeCompanyId;
    }

    getActiveConfig() {
        return this.companies[this.activeCompanyId] || {};
    }

    getConfig(companyId) {
        return this.companies[companyId] || null;
    }
}

// Exporta como singleton
module.exports = new CompanyManager();
