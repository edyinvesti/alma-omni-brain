const Database = require('./database');
const CompanyManager = require('./company_manager');

class CompanyDatabase {
    
    _getCompanyId() {
        return CompanyManager.getActiveId();
    }

    async memorySet(key, value) {
        return await Database.memorySet(key, value, this._getCompanyId());
    }

    async memoryGet(key) {
        return await Database.memoryGet(key, this._getCompanyId());
    }

    async historyAdd(userOrAlma, text) {
        return await Database.historyAdd(userOrAlma, text, this._getCompanyId());
    }

    async historyGet(limit = 10) {
        return await Database.historyGet(limit, this._getCompanyId());
    }

    async knowledgeAdd(source, title, content, embedding = null) {
        return await Database.knowledgeAdd(source, title, content, embedding, this._getCompanyId());
    }

    async logInteraction(type, moduleName, payload) {
        return await Database.logInteraction(type, moduleName, payload, this._getCompanyId());
    }

    // --- CRM / Leads ---
    async crmAddLead(name, phone, email, source, notes, status = 'novo') {
        try {
            await Database.client.execute({
                sql: `INSERT INTO crm_leads (company_id, name, phone, email, source, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [this._getCompanyId(), name, phone, email, source, status, notes]
            });
            return true;
        } catch (e) {
            console.error('[COMPANY DB CRM] Erro ao adicionar lead:', e.message);
            return false;
        }
    }

    async crmGetLeads(limit = 20) {
        try {
            const results = await Database.client.execute({
                sql: `SELECT id, name, phone, email, status, source, notes, created_at FROM crm_leads WHERE company_id = ? ORDER BY id DESC LIMIT ?`,
                args: [this._getCompanyId(), limit]
            });
            return results.rows || [];
        } catch (e) {
            console.error('[COMPANY DB CRM] Erro ao listar leads:', e.message);
            return [];
        }
    }
}

module.exports = new CompanyDatabase();
