export async function init() {
    const container = document.getElementById('view-finance');
    container.innerHTML = `
        <div class="glass-panel p-10 text-center">
            <h2 class="text-2xl font-bold text-amber-500">💰 Módulo Financeiro</h2>
            <p class="text-gray-400 mt-2">Em construção: Mapa de calor e fluxo de caixa detalhado.</p>
        </div>
    `;
}
