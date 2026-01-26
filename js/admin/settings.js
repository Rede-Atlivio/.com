export async function init() {
    const container = document.getElementById('view-settings');
    container.innerHTML = `
        <div class="glass-panel p-6">
            <h2 class="text-lg font-bold text-white mb-4">Configurações Globais</h2>
            <div class="mb-4">
                <label class="block text-xs font-bold text-gray-500 mb-1">AVISO NO TOPO DO APP</label>
                <input type="text" class="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white" placeholder="Ex: Manutenção programada...">
            </div>
            <button class="bg-blue-600 text-white px-4 py-2 rounded font-bold text-xs">SALVAR</button>
        </div>
        <div class="mt-6 border border-red-900/30 bg-red-900/10 p-6 rounded-xl">
            <h3 class="text-red-500 font-bold mb-2">Zona de Perigo</h3>
            <button class="bg-red-600 text-white px-4 py-2 rounded font-bold text-xs">🔥 ZERAR DADOS DEMO</button>
        </div>
    `;
}
