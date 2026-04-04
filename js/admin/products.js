import { collection, getDocs, addDoc, deleteDoc, doc, getDoc, updateDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
const db = window.db; // Solda a conexão global
let editId = null;

export async function init() {
    console.log("🛒 Admin Loja: Iniciando Sistema V2026...");
    
    const header = document.getElementById('list-header-products');
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
   const tbody = document.getElementById('list-body-products');
   const count = document.getElementById('list-count-products');
    if(!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center"><div class="loader mx-auto border-blue-500"></div></td></tr>`;

    try {
       const q = query(collection(window.db, "products"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);

        tbody.innerHTML = "";
        if(count) count.innerText = `${snap.size} produtos`;

        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-gray-500">Loja vazia.</td></tr>`;
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            let thumb = data.img ? `<img src="${data.img}" class="w-12 h-12 object-cover rounded border bg-white">` : '📦';
            
            let precoDisplay = `
                <div class="flex flex-col">
                    <span class="font-black text-purple-600 text-sm">${data.preco_atlix || 0} ATLIX</span>
                    <span class="text-[9px] text-gray-400 uppercase font-bold">Reserva: R$ ${parseFloat(data.preco || 0).toFixed(2)}</span>
                </div>`;

            let badge = data.tag ? `<span class="bg-purple-100 text-purple-700 text-[9px] px-2 py-1 rounded font-bold uppercase">${data.tag}</span>` : '';


            tbody.innerHTML += `
                <tr class="border-b border-slate-800/50 hover:bg-slate-900/50 transition">
                    <td class="p-3 flex items-center gap-3">
                        ${thumb}
                        <div>
                            <div class="flex items-center gap-2">
                                <p class="font-bold text-sm text-white">${data.nome}</p>
                                ${badge}
                            </div>
                            <p class="text-[10px] text-gray-500 truncate max-w-[200px]">${data.headline || ''}</p>
                        </div>
                    </td>
                    <td class="p-3">${precoDisplay}</td>
                    <td class="p-3 text-center">
                        <span class="text-[10px] font-bold uppercase ${data.tipo === 'virtual' ? 'text-blue-500' : 'text-orange-500'}">
                            ${data.tipo === 'virtual' ? '☁️ Virtual' : '📦 Físico'}
                        </span>
                    </td>
                    <td class="p-3 text-right">
                        <button onclick="window.editarProd('${d.id}')" class="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white p-2 rounded mr-1 transition">✏️</button>
                        <button onclick="window.excluirProd('${d.id}')" class="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white p-2 rounded transition">🗑️</button>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error("Erro lista:", e); }
}

async function abrirModalProduto(id = null) {
    const modal = document.getElementById('modal-admin-prod');
    const form = document.getElementById('form-prod');
    const titulo = document.getElementById('modal-title-prod');
    
    if(!modal || !form) return;
    form.reset();
    editId = id;

    if (titulo) titulo.innerText = id ? "EDITAR PRODUTO" : "CADASTRAR PRODUTO";

    if(id) {
        // 🛰️ BUSCA DIRETA: Pega o dado fresco do banco para editar sem erros de string
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const snap = await getDoc(doc(window.db, "products", id));
        if(!snap.exists()) return;
        const data = snap.data();

        // Preenchimento dos campos
        document.getElementById('prod-headline').value = data.headline || "";
        document.getElementById('prod-nome').value = data.nome || "";
        document.getElementById('prod-preco-atlix').value = data.preco_atlix || "";
        document.getElementById('prod-preco').value = data.preco || "";
        document.getElementById('prod-img').value = data.img || "";
        document.getElementById('prod-video').value = data.url_video || "";
        document.getElementById('prod-video-real').value = data.url_video_real || "";
        document.getElementById('prod-passo1').value = data.passo1 || "";
        document.getElementById('prod-passo2').value = data.passo2 || "";
        document.getElementById('prod-passo3').value = data.passo3 || "";
        document.getElementById('prod-cta-texto').value = data.cta_texto || "";
        document.getElementById('prod-cta-destino').value = data.cta_destino || "";
        document.getElementById('prod-resultado').value = data.resultado_principal || "";
        document.getElementById('prod-tempo').value = data.tempo_consumo || "";
        document.getElementById('prod-nivel').value = data.nivel_produto || "1";
        document.getElementById('prod-categoria').value = data.categoria || "vantagens";
        document.getElementById('prod-vendas').value = data.vendas_fake || 0;
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
            headline: document.getElementById('prod-headline').value,
            nome: document.getElementById('prod-nome').value,
            preco_atlix: parseInt(document.getElementById('prod-preco-atlix').value) || 0,
            preco: parseFloat(document.getElementById('prod-preco').value) || 0,
            tipo: "virtual",
            img: document.getElementById('prod-img').value,
            url_video: document.getElementById('prod-video').value,
            url_video_real: document.getElementById('prod-video-real').value,
            passo1: document.getElementById('prod-passo1').value,
            passo2: document.getElementById('prod-passo2').value,
            passo3: document.getElementById('prod-passo3').value,
            cta_texto: document.getElementById('prod-cta-texto').value,
            cta_destino: document.getElementById('prod-cta-destino').value,
            resultado_principal: document.getElementById('prod-resultado').value || "",
            tempo_consumo: document.getElementById('prod-tempo').value || "2 min",
            nivel_produto: parseInt(document.getElementById('prod-nivel').value) || 1,
            categoria: document.getElementById('prod-categoria').value || "vantagens",
            vendas_fake: parseInt(document.getElementById('prod-vendas').value) || 0,
            updated_at: serverTimestamp()
        };

        if (editId) {
            await updateDoc(doc(window.db, "products", editId), payload);
            alert("✅ Atualizado com sucesso!");
        } else {
            payload.created_at = serverTimestamp();
            await addDoc(collection(window.db, "products"), payload);
            alert("✅ Criado com sucesso!");
        }
        fecharModalProd();
        carregarLista();
    } catch (error) { alert("Erro: " + error.message); } 
    finally { btn.innerText = "SALVAR E PUBLICAR"; btn.disabled = false; }
}

async function excluirProd(id) {
    if(!confirm("Deseja realmente excluir este item da loja?")) return;
    try {
        await deleteDoc(doc(window.db, "products", id));
        carregarLista();
    } catch(e) { alert("Erro ao excluir"); }
}

function fecharModalProd() {
    const modal = document.getElementById('modal-admin-prod');
    if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function renderizarModalProduto() {
    if(document.getElementById('modal-admin-prod')) return;

    const div = document.createElement('div');
    div.id = 'modal-admin-prod';
    div.className = "fixed inset-0 z-[100] bg-black/90 hidden items-center justify-center p-4 backdrop-blur-sm";
    div.innerHTML = `
        <div class="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden border-t-8 border-purple-600">
            <div class="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden border-t-8 border-purple-600 animate-fade">
            <div class="bg-slate-900 p-5 flex justify-between items-center text-white">
                <div>
                    <h3 id="modal-title-prod" class="font-black text-sm uppercase italic">GESTÃO DE PRODUTO</h3>
                    <p class="text-[9px] text-gray-400 uppercase tracking-widest">Configuração V2026</p>
                </div>
                <button onclick="window.fecharModalProd()" class="text-gray-400 hover:text-white font-bold text-2xl">&times;</button>
            </div>
            <form id="form-prod" onsubmit="window.salvarProduto(event)" class="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar text-slate-800">
                
                <div class="grid grid-cols-2 gap-2">
                    <input type="text" id="prod-headline" placeholder="Headline Impacto" class="border-2 p-3 rounded-xl">
                    <input type="text" id="prod-nome" placeholder="Nome do Produto" class="border-2 p-3 rounded-xl" required>
                </div>

                <input type="text" id="prod-resultado" placeholder="Benefício Principal (O que ele ganha?)" class="w-full border-2 p-3 rounded-xl bg-emerald-50 font-bold">
                
                <div class="grid grid-cols-3 gap-2">
                    <input type="number" id="prod-preco-atlix" placeholder="Preço ATLIX" class="border-2 p-3 rounded-xl" required>
                    <input type="text" id="prod-tempo" placeholder="Tempo Consumo" class="border-2 p-3 rounded-xl">
                    <select id="prod-nivel" class="border-2 p-3 rounded-xl">
                        <option value="1">⭐ Nível 1</option>
                        <option value="2">⭐⭐ Nível 2</option>
                        <option value="3">⭐⭐⭐ Nível 3</option>
                    </select>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <select id="prod-categoria" class="border-2 p-3 rounded-xl">
                        <option value="vantagens">🚀 Vantagens</option>
                        <option value="utilidades">💡 Utilidades</option>
                        <option value="curiosidades">🔍 Curiosidades</option>
                    </select>
                    <input type="number" id="prod-vendas" placeholder="Vendas Fake" class="border-2 p-3 rounded-xl">
                </div>

                <div class="border-t-2 border-dashed border-gray-100 pt-2">
                    <p class="text-[9px] font-black text-purple-600 uppercase mb-2">📦 Entrega Estruturada (Sem HTML)</p>
                    <textarea id="prod-passo1" placeholder="Passo 01: O que fazer primeiro?" class="w-full border-2 p-3 rounded-xl mb-2 text-xs" rows="2"></textarea>
                    <textarea id="prod-passo2" placeholder="Passo 02: O segredo técnico" class="w-full border-2 p-3 rounded-xl mb-2 text-xs" rows="2"></textarea>
                    <textarea id="prod-passo3" placeholder="Passo 03: Como lucrar agora" class="w-full border-2 p-3 rounded-xl mb-2 text-xs" rows="2"></textarea>
                </div>

                <div class="bg-blue-50 p-4 rounded-xl border-2 border-blue-100 space-y-3">
                    <p class="text-[9px] font-black text-blue-600 uppercase mb-1">🔥 AJUSTE DE OURO (Ação Pós-Compra)</p>
                    <input type="text" id="prod-cta-texto" placeholder="Texto do Botão (Ex: Começar Missão!)" class="w-full border-2 p-2 rounded-lg text-xs">
                    <select id="prod-cta-destino" class="w-full border-2 p-2 rounded-lg text-xs font-bold">
                        <option value="">🚫 Nenhum (Apenas fechar)</option>
                        <option value="missoes">🎯 Aba: Micro Tarefas</option>
                        <option value="servicos">🛠️ Aba: Serviços (Radar)</option>
                        <option value="ganhar">💰 Aba: Carteira (Saldo)</option>
                    </select>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <input type="url" id="prod-video" placeholder="Link YouTube (Preview)" class="border-2 p-3 rounded-xl text-xs">
                    <input type="url" id="prod-video-real" placeholder="Link YouTube (Conteúdo Real)" class="border-2 p-3 rounded-xl text-xs">
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <input type="url" id="prod-img" placeholder="URL Capa" class="border-2 p-3 rounded-xl text-xs">
                    <input type="number" step="0.01" id="prod-preco" placeholder="Ref. R$" class="border-2 p-3 rounded-xl text-xs">
                </div>

                <button type="submit" id="btn-save-prod" class="w-full bg-purple-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase">Salvar e Publicar 🚀</button>
            </form>
        </div>
    `;
    document.body.appendChild(div);
}

// 🌍 EXPOSIÇÃO GLOBAL
window.editarProd = abrirModalProduto;
window.excluirProd = excluirProd;
window.salvarProduto = salvarProduto;
window.fecharModalProd = fecharModalProd;
