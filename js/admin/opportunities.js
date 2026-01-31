import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variável para saber se estamos editando ou criando
let editId = null;

// ============================================================================
// 1. INICIALIZAÇÃO (CHAMADA PELO CORE.JS)
// ============================================================================
export async function init() {
    console.log("💼 Admin Oportunidades: Iniciando...");
    
    // 1. Configura o Cabeçalho da Tabela (Usando o padrão do seu Admin 'view-list')
    const header = document.getElementById('list-header');
    if(header) {
        header.innerHTML = `
            <th class="p-3 text-left">TÍTULO & TIPO</th>
            <th class="p-3 text-left">MÍDIA (IMG/LINK)</th>
            <th class="p-3 text-left">PREÇO / VALOR</th>
            <th class="p-3 text-center">STATUS</th>
            <th class="p-3 text-right">AÇÕES</th>
        `;
    }

    // 2. Configura o Botão "Adicionar Novo"
    const btnAdd = document.getElementById('btn-list-add');
    if(btnAdd) {
        btnAdd.style.display = 'block';
        btnAdd.innerHTML = "+ NOVA OPORTUNIDADE";
        btnAdd.onclick = () => abrirModalAdmin();
    }

    // 3. Injeta o Modal de Edição no HTML (Se não existir)
    renderizarModalAdmin();

    // 4. Carrega a Lista
    await carregarLista();

    // Exporta globais para os botões HTML funcionarem
    window.editarOpp = editarOpp;
    window.excluirOpp = excluirOpp;
    window.salvarOpp = salvarOpp;
    window.fecharModalOpp = fecharModalOpp;
}

// ============================================================================
// 2. LISTAGEM (READ)
// ============================================================================
async function carregarLista() {
    const tbody = document.getElementById('list-body');
    const count = document.getElementById('list-count');
    
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader mx-auto border-blue-500"></div></td></tr>`;

    try {
        const q = query(collection(window.db, "oportunidades"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);

        tbody.innerHTML = "";
        count.innerText = `${snap.size} registros`;

        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-500">Nenhuma oportunidade cadastrada.</td></tr>`;
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            
            // Badges Visuais
            let tipoBadge = `<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] uppercase font-bold">${data.tipo}</span>`;
            if(data.tipo === 'cashback') tipoBadge = `<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] uppercase font-bold">💰 Cashback</span>`;
            if(data.tipo === 'alerta') tipoBadge = `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] uppercase font-bold">🔔 Alerta</span>`;
            if(data.tipo === 'produto') tipoBadge = `<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] uppercase font-bold">📦 Produto</span>`;

            // Thumbnail
            let thumb = `<span class="text-gray-300 text-xs">Sem img</span>`;
            if(data.img) thumb = `<img src="${data.img}" class="h-10 w-10 object-cover rounded border border-gray-200">`;

            tbody.innerHTML += `
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td class="p-3">
                        <p class="font-bold text-sm text-gray-800">${data.titulo || 'Sem título'}</p>
                        <p class="text-xs text-gray-500 truncate max-w-[200px]">${data.descricao || ''}</p>
                        <div class="mt-1">${tipoBadge}</div>
                    </td>
                    <td class="p-3">
                        <div class="flex items-center gap-2">
                            ${thumb}
                            <a href="${data.link}" target="_blank" class="text-blue-500 text-xs underline">Link 🔗</a>
                        </div>
                    </td>
                    <td class="p-3 text-sm font-bold text-gray-700">
                        ${data.valor ? `R$ ${data.valor}` : '-'}
                    </td>
                    <td class="p-3 text-center">
                        ${data.is_demo ? '<span class="text-xs bg-yellow-100 text-yellow-700 px-2 rounded">DEMO</span>' : '<span class="text-xs bg-green-100 text-green-700 px-2 rounded">ATIVO</span>'}
                    </td>
                    <td class="p-3 text-right">
                        <button onclick="window.editarOpp('${d.id}', '${encodeURIComponent(JSON.stringify(data))}')" class="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded mr-1">✏️</button>
                        <button onclick="window.excluirOpp('${d.id}')" class="bg-red-50 text-red-600 hover:bg-red-100 p-2 rounded">🗑️</button>
                    </td>
                </tr>
            `;
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Erro ao carregar: ${e.message}</td></tr>`;
    }
}

// ============================================================================
// 3. AÇÕES (CRUD)
// ============================================================================

// Abrir Modal (Criação ou Edição)
function abrirModalAdmin(id = null, dataString = null) {
    const modal = document.getElementById('modal-admin-opp');
    const form = document.getElementById('form-opp');
    const tituloModal = document.getElementById('modal-title-opp');
    
    // Limpa o form
    form.reset();
    editId = null;
    tituloModal.innerText = "NOVA OPORTUNIDADE";

    // Se for edição, preenche
    if(id && dataString) {
        editId = id;
        tituloModal.innerText = "EDITAR OPORTUNIDADE";
        const data = JSON.parse(decodeURIComponent(dataString));
        
        document.getElementById('opp-titulo').value = data.titulo || "";
        document.getElementById('opp-desc').value = data.descricao || "";
        document.getElementById('opp-tipo').value = data.tipo || "geral";
        document.getElementById('opp-link').value = data.link || "";
        document.getElementById('opp-img').value = data.img || "";
        document.getElementById('opp-valor').value = data.valor || "";
        document.getElementById('opp-demo').checked = data.is_demo || false;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Salvar (Create / Update)
async function salvarOpp(e) {
    e.preventDefault(); // Evita reload
    const btn = document.getElementById('btn-save-opp');
    btn.innerText = "SALVANDO..."; btn.disabled = true;

    try {
        const payload = {
            titulo: document.getElementById('opp-titulo').value,
            descricao: document.getElementById('opp-desc').value,
            tipo: document.getElementById('opp-tipo').value,
            link: document.getElementById('opp-link').value,
            img: document.getElementById('opp-img').value,
            valor: document.getElementById('opp-valor').value,
            is_demo: document.getElementById('opp-demo').checked,
            updated_at: serverTimestamp()
        };

        if (editId) {
            // EDITAR
            await updateDoc(doc(window.db, "oportunidades", editId), payload);
            alert("✅ Atualizado com sucesso!");
        } else {
            // CRIAR
            payload.created_at = serverTimestamp();
            await addDoc(collection(window.db, "oportunidades"), payload);
            alert("✅ Criado com sucesso!");
        }

        fecharModalOpp();
        carregarLista();

    } catch (error) {
        alert("Erro: " + error.message);
    } finally {
        btn.innerText = "SALVAR"; btn.disabled = false;
    }
}

// Excluir
async function excluirOpp(id) {
    if(!confirm("TEM CERTEZA? Isso excluirá o item permanentemente.")) return;
    try {
        await deleteDoc(doc(window.db, "oportunidades", id));
        carregarLista();
    } catch (e) {
        alert("Erro ao excluir: " + e.message);
    }
}

function fecharModalOpp() {
    const modal = document.getElementById('modal-admin-opp');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// ============================================================================
// 4. HTML DO MODAL (INJEÇÃO DINÂMICA)
// ============================================================================
function renderizarModalAdmin() {
    if(document.getElementById('modal-admin-opp')) return; // Já existe

    const div = document.createElement('div');
    div.id = 'modal-admin-opp';
    div.className = "fixed inset-0 z-50 bg-black/80 hidden items-center justify-center p-4 backdrop-blur-sm";
    div.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
            <div class="bg-slate-900 p-4 flex justify-between items-center text-white">
                <h3 id="modal-title-opp" class="font-bold text-sm uppercase">NOVA OPORTUNIDADE</h3>
                <button onclick="window.fecharModalOpp()" class="text-gray-400 hover:text-white font-bold text-xl">&times;</button>
            </div>
            
            <form id="form-opp" onsubmit="window.salvarOpp(event)" class="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">TÍTULO PRINCIPAL</label>
                    <input type="text" id="opp-titulo" required class="w-full border border-gray-300 rounded p-2 text-sm focus:border-blue-500 outline-none text-black bg-white">
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">TIPO (TAG)</label>
                        <select id="opp-tipo" class="w-full border border-gray-300 rounded p-2 text-sm bg-white text-black">
                            <option value="geral">Geral</option>
                            <option value="cashback">💰 Cashback</option>
                            <option value="alerta">🔔 Alerta/Aviso</option>
                            <option value="produto">📦 Produto</option>
                            <option value="video">🎬 Vídeo</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">PREÇO/VALOR (Opcional)</label>
                        <input type="text" id="opp-valor" placeholder="Ex: 100.00" class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">LINK DE DESTINO (Afiliado/Vídeo)</label>
                    <input type="url" id="opp-link" placeholder="https://..." class="w-full border border-gray-300 rounded p-2 text-sm text-blue-600 bg-white">
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">URL DA IMAGEM (Capa)</label>
                    <input type="url" id="opp-img" placeholder="https://..." class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white">
                    <p class="text-[9px] text-gray-400 mt-1">Dica: Use links do imgur ou unsplash.</p>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">DESCRIÇÃO CURTA</label>
                    <textarea id="opp-desc" rows="3" class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white"></textarea>
                </div>

                <div class="flex items-center gap-2 border p-3 rounded bg-yellow-50 border-yellow-100">
                    <input type="checkbox" id="opp-demo" class="w-4 h-4">
                    <label for="opp-demo" class="text-xs font-bold text-yellow-800 cursor-pointer">Marcar como DEMONSTRAÇÃO (Aparece etiqueta)</label>
                </div>

                <button type="submit" id="btn-save-opp" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded shadow-lg uppercase tracking-wide">
                    SALVAR DADOS
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(div);
}
