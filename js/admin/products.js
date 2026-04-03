import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let editId = null;

export async function init() {
    console.log("🛒 Admin Loja: Iniciando Sistema Avançado...");
    
    const header = document.getElementById('list-header');
    if(header) {
        header.innerHTML = `
            <th class="p-3 text-left italic font-black text-blue-400">PRODUTO</th>
            <th class="p-3 text-left italic font-black text-purple-400">VALOR (ATLIX)</th>
            <th class="p-3 text-center italic font-black text-gray-400">ESTILO</th>
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
            
            // 💰 Lógica de Preço em ATLIX (V2026)
            let precoDisplay = `
                <div class="flex flex-col">
                    <span class="font-black text-purple-600 text-sm">${data.preco_atlix || 0} ATLIX</span>
                    <span class="text-[9px] text-gray-400 uppercase font-bold">Reserva: R$ ${parseFloat(data.preco || 0).toFixed(2)}</span>
                </div>`;

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

div.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden border-t-8 border-purple-600">
            <div class="bg-slate-900 p-5 flex justify-between items-center text-white">
                <div>
                    <h3 id="modal-title-prod" class="font-black text-sm uppercase italic">GESTÃO DE PRODUTO</h3>
                    <p class="text-[9px] text-gray-400 uppercase tracking-widest">Configuração de Venda Interna</p>
                </div>
                <button onclick="window.fecharModalProd()" class="text-gray-400 hover:text-white font-bold text-2xl">&times;</button>
            </div>
            <form id="form-prod" onsubmit="window.salvarProduto(event)" class="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Headline (A Promessa que Vende)</label>
                    <input type="text" id="prod-headline" placeholder="Ex: Aprenda o segredo das Missões Black" class="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-bold text-purple-600 bg-gray-50 focus:border-purple-300 outline-none transition">
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-1">
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Nome do Item</label>
                        <input type="text" id="prod-nome" required class="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-bold text-gray-800 bg-gray-50">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Preço (ATLIX)</label>
                        <input type="number" id="prod-preco-atlix" required placeholder="Ex: 50" class="w-full border-2 border-purple-100 rounded-xl p-3 text-sm font-black text-purple-700 bg-purple-50">
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Referência R$ (Opceional)</label>
                        <input type="number" step="0.01" id="prod-preco" class="w-full border-2 border-gray-100 rounded-xl p-3 text-sm bg-gray-50">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Tipo</label>
                        <select id="prod-tipo" class="w-full border-2 border-gray-100 rounded-xl p-3 text-sm bg-gray-50">
                            <option value="virtual">☁️ Virtual (Conteúdo)</option>
                            <option value="fisico">📦 Físico (Em breve)</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">URL do Vídeo (YouTube/Vimeo)</label>
                    <input type="url" id="prod-video" placeholder="https://youtube.com/embed/..." class="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-mono text-blue-600 bg-gray-50">
                </div>

                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Conteúdo do Guia (Texto/HTML)</label>
                    <textarea id="prod-entrega" rows="4" placeholder="Instruções que o usuário verá após a compra..." class="w-full border-2 border-gray-100 rounded-xl p-3 text-sm text-gray-700 bg-gray-50 outline-none"></textarea>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Imagem (URL)</label>
                        <input type="url" id="prod-img" placeholder="https://..." class="w-full border-2 border-gray-100 rounded-xl p-3 text-[10px] text-gray-500 bg-gray-50">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Etiqueta</label>
                        <input type="text" id="prod-tag" placeholder="Ex: 🔥 POPULAR" class="w-full border-2 border-gray-100 rounded-xl p-3 text-xs font-black text-gray-800 bg-gray-50">
                    </div>
                </div>

                <button type="submit" id="btn-save-prod" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-2xl shadow-xl transition uppercase tracking-widest text-xs">Salvar e Publicar na Loja 🚀</button>
            </form>
        </div>
    `;

async function salvarProduto(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-prod');
    btn.innerText = "SALVANDO..."; btn.disabled = true;

    try {
       const payload = {
            headline: document.getElementById('prod-headline').value,
            nome: document.getElementById('prod-nome').value,
            desc: document.getElementById('prod-desc').value,
            preco_atlix: parseInt(document.getElementById('prod-preco-atlix').value) || 0,
            preco: parseFloat(document.getElementById('prod-preco').value) || 0, // Referência R$
            tipo: document.getElementById('prod-tipo').value,
            tag: document.getElementById('prod-tag').value,
            img: document.getElementById('prod-img').value,
            url_video: document.getElementById('prod-video').value,
            texto_entrega: document.getElementById('prod-entrega').value,
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
