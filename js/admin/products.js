import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let editId = null;

export async function init() {
    console.log("🛒 Admin Loja: Iniciando Sistema Avançado...");
    
    const header = document.getElementById('list-header');
    if(header) {
        header.innerHTML = `
            <th class="p-3 text-left">PRODUTO</th>
            <th class="p-3 text-left">PREÇIFICAÇÃO (DE / POR)</th>
            <th class="p-3 text-center">TIPO</th>
            <th class="p-3 text-right">AÇÕES</th>
        `;
    }

    const btnAdd = document.getElementById('btn-list-add');
    if(btnAdd) {
        btnAdd.style.display = 'block';
        btnAdd.innerHTML = "+ NOVO ITEM NA LOJA";
        btnAdd.onclick = () => abrirModalProduto();
    }

    renderizarModalProduto();
    await carregarLista();
}

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
            tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-gray-500">Loja vazia.</td></tr>`;
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            let thumb = data.img ? `<img src="${data.img}" class="w-12 h-12 object-cover rounded border bg-white">` : '📦';
            
            // Lógica de Preço (Promoção)
            let precoDisplay = `<span class="font-bold text-gray-600">R$ ${parseFloat(data.preco).toFixed(2)}</span>`;
            if (data.preco_promo && parseFloat(data.preco_promo) > 0) {
                precoDisplay = `
                    <div class="flex flex-col">
                        <span class="text-[10px] text-red-400 line-through">R$ ${parseFloat(data.preco).toFixed(2)}</span>
                        <span class="font-black text-green-600">R$ ${parseFloat(data.preco_promo).toFixed(2)}</span>
                    </div>`;
            }

            let badge = data.tag ? `<span class="bg-purple-100 text-purple-700 text-[9px] px-2 py-1 rounded font-bold uppercase">${data.tag}</span>` : '';

            const safeData = encodeURIComponent(JSON.stringify(data));

            tbody.innerHTML += `
                <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td class="p-3 flex items-center gap-3">
                        ${thumb}
                        <div>
                            <div class="flex items-center gap-2">
                                <p class="font-bold text-sm text-gray-800">${data.nome}</p>
                                ${badge}
                            </div>
                            <p class="text-[10px] text-gray-500 truncate max-w-[200px]">${data.desc || ''}</p>
                        </div>
                    </td>
                    <td class="p-3">${precoDisplay}</td>
                    <td class="p-3 text-center">
                        <span class="text-[10px] font-bold uppercase ${data.tipo === 'virtual' ? 'text-blue-500' : 'text-orange-500'}">
                            ${data.tipo === 'virtual' ? '☁️ Virtual' : '📦 Físico'}
                        </span>
                    </td>
                    <td class="p-3 text-right">
                        <button onclick="window.editarProd('${d.id}', '${safeData}')" class="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded mr-1">✏️</button>
                        <button onclick="window.excluirProd('${d.id}')" class="bg-red-50 text-red-600 hover:bg-red-100 p-2 rounded">🗑️</button>
                    </td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

function abrirModalProduto(id = null, dataString = null) {
    const modal = document.getElementById('modal-admin-prod');
    const form = document.getElementById('form-prod');
    const titulo = document.getElementById('modal-title-prod');
    
    form.reset();
    editId = null;
    titulo.innerText = "CADASTRAR PRODUTO";

    if(id && dataString) {
        editId = id;
        titulo.innerText = "EDITAR PRODUTO";
        const data = JSON.parse(decodeURIComponent(dataString));
        
        document.getElementById('prod-nome').value = data.nome || "";
        document.getElementById('prod-desc').value = data.desc || "";
        document.getElementById('prod-preco').value = data.preco || "";
        document.getElementById('prod-promo').value = data.preco_promo || "";
        document.getElementById('prod-img').value = data.img || "";
        document.getElementById('prod-link').value = data.link || "";
        document.getElementById('prod-tipo').value = data.tipo || "fisico";
        document.getElementById('prod-tag').value = data.tag || "";
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
            preco_promo: parseFloat(document.getElementById('prod-promo').value) || 0,
            tipo: document.getElementById('prod-tipo').value,
            tag: document.getElementById('prod-tag').value,
            img: document.getElementById('prod-img').value,
            link: document.getElementById('prod-link').value,
            updated_at: serverTimestamp()
        };

        if (editId) {
            await updateDoc(doc(window.db, "products", editId), payload);
            alert("✅ Atualizado!");
        } else {
            payload.created_at = serverTimestamp();
            await addDoc(collection(window.db, "products"), payload);
            alert("✅ Criado!");
        }
        fecharModalProd();
        carregarLista();
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.innerText = "SALVAR"; btn.disabled = false; }
}

async function excluirProd(id) {
    if(!confirm("Excluir item?")) return;
    await deleteDoc(doc(window.db, "products", id));
    carregarLista();
}

function fecharModalProd() {
    document.getElementById('modal-admin-prod').classList.add('hidden');
    document.getElementById('modal-admin-prod').classList.remove('flex');
}

function renderizarModalProduto() {
    if(document.getElementById('modal-admin-prod')) return;

    const div = document.createElement('div');
    div.id = 'modal-admin-prod';
    div.className = "fixed inset-0 z-50 bg-black/80 hidden items-center justify-center p-4 backdrop-blur-sm";
    div.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
            <div class="bg-slate-900 p-4 flex justify-between items-center text-white">
                <h3 id="modal-title-prod" class="font-bold text-sm uppercase">PRODUTO</h3>
                <button onclick="window.fecharModalProd()" class="text-gray-400 hover:text-white font-bold text-xl">&times;</button>
            </div>
            <form id="form-prod" onsubmit="window.salvarProduto(event)" class="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                <div class="grid grid-cols-3 gap-4">
                    <div class="col-span-2">
                        <label class="block text-xs font-bold text-gray-500 mb-1">NOME DO PRODUTO</label>
                        <input type="text" id="prod-nome" required class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">TIPO</label>
                        <select id="prod-tipo" class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white">
                            <option value="fisico">📦 Físico</option>
                            <option value="virtual">☁️ Virtual</option>
                        </select>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 bg-green-50 p-3 rounded border border-green-100">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">PREÇO ORIGINAL (R$)</label>
                        <input type="number" step="0.01" id="prod-preco" required class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-green-600 mb-1">PREÇO PROMOCIONAL</label>
                        <input type="number" step="0.01" id="prod-promo" placeholder="Opcional" class="w-full border border-green-300 rounded p-2 text-sm text-green-700 font-bold bg-white">
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">ETIQUETA (TAG)</label>
                        <input type="text" id="prod-tag" placeholder="Ex: OFERTA" class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white uppercase">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">IMAGEM (URL)</label>
                        <input type="url" id="prod-img" placeholder="https://..." class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">DESCRIÇÃO CURTA</label>
                    <input type="text" id="prod-desc" required class="w-full border border-gray-300 rounded p-2 text-sm text-black bg-white">
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">LINK DE COMPRA / DOWNLOAD</label>
                    <input type="url" id="prod-link" placeholder="https://..." required class="w-full border border-gray-300 rounded p-2 text-sm text-blue-600 bg-white font-bold">
                </div>

                <button type="submit" id="btn-save-prod" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded shadow-lg uppercase">SALVAR NA LOJA</button>
            </form>
        </div>
    `;
    document.body.appendChild(div);
}

// GLOBAIS
window.editarProd = abrirModalProduto;
window.excluirProd = excluirProd;
window.salvarProduto = salvarProduto;
window.fecharModalProd = fecharModalProd;
