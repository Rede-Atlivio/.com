import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let editId = null;

// ============================================================================
// 1. INICIALIZAÇÃO
// ============================================================================
export async function init() {
    console.log("🛒 Admin Produtos: Iniciando...");
    
    // Configura Cabeçalho da Tabela
    const header = document.getElementById('list-header');
    if(header) {
        header.innerHTML = `
            <th class="p-3 text-left">PRODUTO</th>
            <th class="p-3 text-left">PREÇO</th>
            <th class="p-3 text-left">LINK</th>
            <th class="p-3 text-right">AÇÕES</th>
        `;
    }

    // Configura Botão Adicionar
    const btnAdd = document.getElementById('btn-list-add');
    if(btnAdd) {
        btnAdd.style.display = 'block';
        btnAdd.innerHTML = "+ NOVO PRODUTO";
        btnAdd.onclick = () => abrirModalProduto();
    }

    renderizarModalProduto();
    await carregarLista();
}

// ============================================================================
// 2. LISTAGEM
// ============================================================================
async function carregarLista() {
    const tbody = document.getElementById('list-body');
    const count = document.getElementById('list-count');
    
    tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center"><div class="loader mx-auto border-blue-500"></div></td></tr>`;

    try {
        const q = query(collection(window.db, "products"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);

        tbody.innerHTML = "";
        count.innerText = `${snap.size} produtos`;

        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-gray-500">Nenhum produto cadastrado.</td></tr>`;
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            let thumb = data.img ? `<img src="${data.img}" class="w-10 h-10 object-cover rounded border">` : '📷';

            // Safe JSON para o botão editar
            const safeData = encodeURIComponent(JSON.stringify(data));

            tbody.innerHTML += `
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td class="p-3 flex items-center gap-3">
                        ${thumb}
                        <div>
                            <p class="font-bold text-sm text-gray-800">${data.nome}</p>
                            <p class="text-[10px] text-gray-500 truncate max-w-[200px]">${data.desc || ''}</p>
                        </div>
                    </td>
                    <td class="p-3 text-green-600 font-bold font-mono">
                        R$ ${parseFloat(data.preco).toFixed(2)}
                    </td>
                    <td class="p-3">
                        <a href="${data.link}" target="_blank" class="text-blue-500 text-xs underline">Link 🔗</a>
                    </td>
                    <td class="p-3 text-right">
                        <button onclick="window.editarProd('${d.id}', '${safeData}')" class="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded mr-1">✏️</button>
                        <button onclick="window.excluirProd('${d.id}')" class="bg-red-50 text-red-600 hover:bg-red-100 p-2 rounded">🗑️</button>
                    </td>
                </tr>
            `;
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Erro: ${e.message}</td></tr>`;
    }
}

// ============================================================================
// 3. AÇÕES CRUD
// ============================================================================
function abrirModalProduto(id = null, dataString = null) {
    const modal = document.getElementById('modal-admin-prod');
    const form = document.getElementById('form-prod');
    const titulo = document.getElementById('modal-title-prod');
    
    form.reset();
    editId = null;
    titulo.innerText = "NOVO PRODUTO";

    if(id && dataString) {
        editId = id;
        titulo.innerText = "EDITAR PRODUTO";
        const data = JSON.parse(decodeURIComponent(dataString));
        
        document.getElementById('prod-nome').value = data.nome || "";
        document.getElementById('prod-desc').value = data.desc || "";
        document.getElementById('prod-preco').value = data.preco || "";
        document.getElementById('prod-img').value = data.img || "";
        document.getElementById('prod-link').value = data.link || "";
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function salvarProduto(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-prod');
    btn.innerText = "SALVANDO..."; btn.disabled = true;

    try {
        const payload = {
            nome: document.getElementById('prod-nome').value,
            desc: document.getElementById('prod-desc').value,
            preco: parseFloat(document.getElementById('prod-preco').value),
            img: document.getElementById('prod-img').value,
            link: document.getElementById('prod-link').value,
            updated_at: serverTimestamp()
        };

        if (editId) {
            await updateDoc(doc(window.db, "products", editId), payload);
            alert("✅ Produto atualizado!");
        } else {
            payload.created_at = serverTimestamp();
            await addDoc(collection(window.db, "products"), payload);
            alert("✅ Produto criado!");
        }

        fecharModalProd();
        carregarLista();

    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.innerText = "SALVAR"; btn.disabled = false; }
}

async function excluirProd(id) {
    if(!confirm("Excluir produto?")) return;
    await deleteDoc(doc(window.db, "products", id));
    carregarLista();
}

function fecharModalProd() {
    const modal = document.getElementById('modal-admin-prod');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// ============================================================================
// 4. RENDER DO MODAL
// ============================================================================
function renderizarModalProduto() {
    if(document.getElementById('modal-admin-prod')) return;

    const div = document.createElement('div');
    div.id = 'modal-admin-prod';
    div.className = "fixed inset-0 z-50 bg-black/80 hidden items-center justify-center p-4 backdrop-blur-sm";
    div.innerHTML = `
        <div class="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
            <div class="bg-slate-900 p-4 flex justify-between items-center text-white">
                <h3 id="modal-title-prod" class="font-bold text-sm uppercase">NOVO PRODUTO</h3>
                <button onclick="window.fecharModalProd()" class="text-gray-400 hover:text-white font-bold text-xl">&times;</button>
            </div>
            <form id="form-prod" onsubmit="window.salvarProduto(event)" class="p-6 space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">NOME DO PRODUTO</label>
                    <input type="text" id="prod-nome" required class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">DESCRIÇÃO CURTA</label>
                    <input type="text" id="prod-desc" required class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">PREÇO (R$)</label>
                        <input type="number" step="0.01" id="prod-preco" required class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">IMAGEM (URL)</label>
                        <input type="url" id="prod-img" placeholder="https://..." class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">LINK DE COMPRA/AFILIADO</label>
                    <input type="url" id="prod-link" placeholder="https://..." required class="w-full border border-gray-300 rounded p-2 text-sm text-blue-600 bg-white">
                </div>
                <button type="submit" id="btn-save-prod" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded shadow-lg">SALVAR</button>
            </form>
        </div>
    `;
    document.body.appendChild(div);
}

// EXPORTAÇÕES GLOBAIS
window.editarProd = abrirModalProduto;
window.excluirProd = excluirProd;
window.salvarProduto = salvarProduto;
window.fecharModalProd = fecharModalProd;
