function garantirContainerRadar() {
    const stage = document.getElementById('radar-stage');
    const toggle = document.getElementById('online-toggle');
    if (!stage) return null;

    const isOnline = toggle ? toggle.checked : false;

    // 1. ESTADO OFFLINE
    if (!isOnline) {
        stage.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 animate-fadeIn">
                <div class="relative bg-white rounded-full p-6 shadow-xl border-4 border-gray-300 text-4xl opacity-50 grayscale">💤</div>
                <p class="text-xs font-black text-gray-500 uppercase tracking-widest mt-4">Você está Offline</p>
            </div>`;
        pararSomRadarSeNecessario();
        return stage;
    }

    // 2. ESTADO ONLINE (BUSCANDO OU COM CARDS)
    // Verifica se já existe um container de cards no palco
    let container = document.getElementById('radar-container');
    const temCardsNoDOM = container ? container.querySelectorAll('.request-card, .atlivio-pill').length > 0 : false;

    if (!temCardsNoDOM) {
        // Renderiza Antena se estiver vazio
        stage.innerHTML = `
            <div id="radar-empty-state" class="flex flex-col items-center justify-center py-20 animate-fadeIn">
                <div class="relative flex h-24 w-24 items-center justify-center mb-4">
                    <div class="animate-ping absolute h-full w-full rounded-full bg-blue-500 opacity-20"></div>
                    <div class="relative bg-white rounded-full p-6 shadow-xl border-4 border-blue-600 text-4xl">📡</div>
                </div>
                <p class="text-xs font-black text-blue-900 uppercase tracking-widest animate-pulse text-center">Procurando clientes...</p>
            </div>
            <div id="radar-container" class="hidden flex flex-col items-center w-full max-w-[400px] space-y-4"></div>`;
    } else {
        // Se já tem cards, garante que o container esteja visível e a antena suma
        if (container) container.classList.remove('hidden');
        const antena = document.getElementById('radar-empty-state');
        if (antena) antena.remove();
    }
    
    pararSomRadarSeNecessario();
    return document.getElementById('radar-container');
}
