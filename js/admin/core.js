// ... (parte inicial igual) ...

// ============================================================================
// 2. ROTEADOR DE MÓDULOS (ATUALIZADO)
// ============================================================================
window.switchView = async function(viewName) {
    window.activeView = viewName;
    console.log(`🚀 Carregando: ${viewName}`);
    
    // Esconde todas as divs
    ['view-dashboard', 'view-list', 'view-finance', 'view-automation', 'view-settings', 'view-support', 'view-audit', 'view-tutorials'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    
    const titleEl = document.getElementById('page-title');
    if(titleEl) titleEl.innerText = viewName.toUpperCase();

    let moduleFile, containerId;
    
    // ROTAS
    if (viewName === 'dashboard') { moduleFile = './dashboard.js'; containerId = 'view-dashboard'; }
    else if (['users', 'services'].includes(viewName)) { moduleFile = './users.js'; containerId = 'view-list'; }
    else if (['jobs', 'vagas'].includes(viewName)) { moduleFile = './jobs.js'; containerId = 'view-list'; }
    else if (viewName === 'missions') { moduleFile = './missions.js'; containerId = 'view-list'; } // AGORA TEM ARQUIVO
    else if (viewName === 'opportunities') { moduleFile = './opportunities.js'; containerId = 'view-list'; } // AGORA TEM ARQUIVO
    else if (viewName === 'automation') { moduleFile = './automation.js'; containerId = 'view-automation'; }
    else if (viewName === 'finance') { moduleFile = './finance.js'; containerId = 'view-finance'; }
    else if (viewName === 'settings') { moduleFile = './settings.js'; containerId = 'view-settings'; }
    else if (viewName === 'support') { moduleFile = './support.js'; containerId = 'view-support'; }
    else if (viewName === 'audit') { moduleFile = './audit.js'; containerId = 'view-audit'; }
    else if (viewName === 'tutorials') { moduleFile = './tutorials.js'; containerId = 'view-tutorials'; }

    // Mostra o container correto
    if(containerId) document.getElementById(containerId).classList.remove('hidden');

    if (moduleFile) {
        try {
            const module = await import(`${moduleFile}?v=${Date.now()}`);
            if (module.init) await module.init(viewName);
        } catch (e) {
            console.error(e);
            alert(`Erro no módulo ${viewName}: ${e.message}`);
        }
    }
};
