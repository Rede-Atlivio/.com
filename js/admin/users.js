export async function init(viewType) {
    // viewType será 'users' ou 'services'
    const headers = document.getElementById('list-header');
    const title = viewType === 'users' ? "USUÁRIOS" : "VITRINE DE SERVIÇOS";
    
    // Configura Headers
    if (viewType === 'users') {
        headers.innerHTML = `<th class="p-3">NOME</th><th class="p-3">EMAIL</th><th class="p-3">STATUS</th><th class="p-3">AÇÕES</th>`;
    } else {
        headers.innerHTML = `<th class="p-3">PRESTADOR</th><th class="p-3">CATEGORIA</th><th class="p-3">SCORE</th><th class="p-3">STATUS</th><th class="p-3">AÇÕES</th>`;
    }

    console.log(`✅ Módulo Users carregado para: ${viewType}`);
    // A função de carregar a lista virá no próximo passo
    window.loadList(viewType); // Chama a função global se existir, ou implementaremos aqui
}
