export async function init(viewType) {
    const headers = document.getElementById('list-header');
    
    if (viewType === 'candidatos') {
        headers.innerHTML = `<th class="p-3">NOME</th><th class="p-3">VAGA APLICADA</th><th class="p-3">DATA</th><th class="p-3">STATUS</th><th class="p-3">CURRÍCULO</th>`;
    } else if (viewType === 'jobs') {
        headers.innerHTML = `<th class="p-3">TÍTULO</th><th class="p-3">EMPRESA</th><th class="p-3">SALÁRIO</th><th class="p-3">STATUS</th><th class="p-3">AÇÕES</th>`;
    } else {
        headers.innerHTML = `<th class="p-3">TAREFA</th><th class="p-3">RECOMPENSA</th><th class="p-3">TIPO</th><th class="p-3">STATUS</th><th class="p-3">AÇÕES</th>`;
    }

    console.log(`✅ Módulo Jobs carregado para: ${viewType}`);
}
