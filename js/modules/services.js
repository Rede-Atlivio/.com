import { db, auth } from '../app.js';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, updateDoc, arrayUnion, arrayRemove, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO: CATEGORIAS E VALORES MÍNIMOS ---
export const CATEGORIAS_ATIVAS = [
    { id: 'eventos', label: '🍸 Eventos & Festas', icon: '🍸', minPrice: 120 },
    { id: 'residenciais', label: '🏠 Serviços Residenciais', icon: '🏠', minPrice: 150 },
    { id: 'limpeza', label: '🧹 Limpeza & Organização', icon: '🧹', minPrice: 130 },
    { id: 'transporte', label: '🚗 Transporte (Uber/99/Frete)', icon: '🚗', minPrice: 60 },
    { id: 'musica', label: '🎵 Música & Entretenimento', icon: '🎵', minPrice: 250 },
    { id: 'audiovisual', label: '📸 Audiovisual & Criação', icon: '📸', minPrice: 300 },
    { id: 'tecnologia', label: '💻 Tecnologia & Digital', icon: '💻', minPrice: 150 },
    { id: 'aulas', label: '🧑‍🏫 Aulas & Educação', icon: '🧑‍🏫', minPrice: 80 },
    { id: 'beleza', label: '💆 Saúde & Beleza', icon: '💆', minPrice: 100 },
    { id: 'pets', label: '🐶 Pets & Cuidados', icon: '🐶', minPrice: 50 },
    { id: 'aluguel', label: '🏗 Aluguel de Itens', icon: '🏗', minPrice: 150 },
    { id: 'gerais', label: '🤝 Serviços Gerais / Bicos', icon: '🤝', minPrice: 100 }
];

let servicesUnsubscribe = null;

// ============================================================================
// 1. VITRINE (CLIENTE) - COM VACINA ANTI-CRASH
// ============================================================================
export async function carregarServicos(filtroCategoria = null) {
    const container = document.getElementById('lista-prestadores-realtime') || document.getElementById('lista-servicos');
    if (!container) return; // Aborta silenciosamente se não estiver na tela de vitrine

    // Gestão dos Filtros Visuais
    const containerFiltros = document.getElementById('category-filters');
    if(containerFiltros) {
        if(container.offsetParent !== null) { // Só mostra se a vitrine estiver visível
            containerFiltros.classList.remove('hidden');
            if(containerFiltros.innerHTML.trim() === "") {
                containerFiltros.innerHTML = `
                    <div class="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        <button onclick="window.filtrarServicos('todos')" class="bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-md">Todos</button>
                        ${CATEGORIAS_ATIVAS.map(cat => `
                            <button onclick="window.filtrarServicos('${cat.label}')" class="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-blue-50 transition">
                                ${cat.icon} ${cat.label.split(' ')[1]}...
                            </button>
                        `).join('')}
                    </div>
                `;
            }
        } else {
            containerFiltros.classList.add('hidden');
        }
    }

    container.innerHTML = `<div class="loader mx-auto border-blue-500 mt-10"></div>`;

    let q = query(collection(db, "active_providers"), where("status", "==", "aprovado"));
    if (servicesUnsubscribe) servicesUnsubscribe();

    servicesUnsubscribe = onSnapshot(q, (snapshot) => {
        let servicos = [];
        snapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id;
            servicos.push(data);
        });

        // Ordenação Inteligente (Online primeiro, depois Rating)
        servicos.sort((a, b) => {
            if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
            return (b.rating_avg || 0) - (a.rating_avg || 0);
        });

        if (filtroCategoria && filtroCategoria !== 'todos') {
            servicos = servicos.filter(s => 
                s.services && s.services.some(sub => sub.category.includes(filtroCategoria) || sub.category === filtroCategoria)
            );
        }
        renderizarCards(servicos, container);
    });
}

// ⚠️ FUNÇÃO RESTAURADA (O Auditor reclamou que ela sumiu)
function renderizarCards(servicos, container) {
    container.innerHTML = "";
    if (servicos.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-12 opacity-50"><p>Nenhum profissional encontrado.</p></div>`;
        return;
    }

    servicos.forEach(user => {
        // VACINA ANTI-CRASH: Garante que dados faltantes não quebrem a tela
        try {
            const temServicos = user.services && Array.isArray(user.services) && user.services.length > 0;
            const mainService = temServicos ? user.services[0] : { category: 'Geral', price: 'A Combinar' };
            
            const nomeProf = user.nome_profissional || user.nome || "Prestador";
            const precoDisplay = mainService.price ? `R$ ${mainService.price}` : 'A Combinar';
            const isOnline = user.is_online === true;
            const statusClass = isOnline ? "" : "grayscale opacity-75";
            const statusText = isOnline ? "ONLINE" : "OFFLINE";
            const statusDot = isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400";
            const coverImg = user.cover_image || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=500';
            const avatarImg = user.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeProf)}&background=random`;

            container.innerHTML += `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative ${statusClass} transition hover:shadow-md flex flex-col h-full animate-fadeIn">
                    <div onclick="window.verPerfilCompleto('${user.id}')" class="h-24 bg-gray-200 relative cursor-pointer">
                        <img src="${coverImg}" class="w-full h-full object-cover">
                        <div class="absolute bottom-2 left-3 flex items-center gap-2">
                            <img src="${avatarImg}" class="w-10 h-10 rounded-full border-2 border-white shadow-md bg-white object-cover">
                            <div>
                                <h3 class="text-white font-bold text-xs text-shadow line-clamp-1">${nomeProf}</h3>
                                <div class="text-[8px] text-yellow-300">⭐ ${user.rating_avg || 5.0}</div>
                            </div>
                        </div>
                    </div>
                    <div class="p-3 flex-1 flex flex-col justify-between">
                        <div class="flex justify-between items-start mb-2">
                            <div class="pr-1 flex-1">
                                <p class="text-[10px] font-bold text-gray-600 uppercase truncate max-w-[140px]">${mainService.category}</p>
                                <p class="text-[9px] text-gray-400 line-clamp-1">${user.bio || 'Disponível para serviços.'}</p>
                            </div>
                            <span class="font-black text-green-600 text-xs whitespace-nowrap">${precoDisplay}</span>
                        </div>
                        <div class="flex items-center gap-2 pt-2 border-t border-gray-50 mt-auto">
                            <div class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full ${statusDot}"></span><span class="text-[8px] font-bold text-gray-400">${statusText}</span></div>
                            <button onclick="window.abrirModalSolicitacao('${user.id}', '${nomeProf}', '${mainService.price}')" class="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow hover:bg-slate-800 flex-1">SOLICITAR</button>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            console.warn("Erro ao renderizar card:", err);
        }
    });
}

// ============================================================================
// 2. MEUS PEDIDOS & HISTÓRICO (CLIENTE)
// ============================================================================

// ⚠️ FUNÇÃO RESTAURADA (O Auditor reclamou que ela sumiu)
export async function carregarPedidosAtivos() {
    const container = document.getElementById('meus-pedidos-andamento');
    if (!container || !auth.currentUser) return;
    
    container.innerHTML = `<div class="loader mx-auto border-blue-500 mt-2"></div>`;
    
    const uid = auth.currentUser.uid;
    const q = query(collection(db, "orders"), where("client_id", "==", uid), orderBy("created_at", "desc"));
    
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        let pedidos = [];
        snap.forEach(d => {
            const p = d.data();
            if(p.status !== 'completed' && p.status !== 'rejected') pedidos.push({id: d.id, ...p});
        });

        if (pedidos.length === 0) { 
            container.innerHTML = `<p class="text-center text-xs text-gray-400 py-6">Nenhum pedido ativo.</p>`; 
            return; 
        }

        pedidos.forEach(p => {
            container.innerHTML += `
                <div onclick="window.abrirChatPedido('${p.id}')" class="bg-white p-3 rounded-xl border border-blue-100 shadow-sm mb-2 cursor-pointer flex justify-between items-center animate-fadeIn hover:bg-blue-50 transition">
                    <div>
                        <h3 class="font-bold text-gray-800 text-sm">${p.provider_name}</h3>
                        <p class="text-[10px] text-gray-500">R$ ${p.offer_value} • <span class="uppercase text-blue-600 font-bold">${p.status}</span></p>
                    </div>
                    <span class="bg-blue-100 text-blue-600 p-2 rounded-full text-xs">💬 Chat</span>
                </div>
            `;
        });
    });
}

// ⚠️ FUNÇÃO RESTAURADA
export async function carregarHistorico() {
    const container = document.getElementById('meus-pedidos-historico');
    if(!container) return;
    container.innerHTML = `<div class="loader mx-auto border-blue-500 mt-2"></div>`;

    const uid = auth.currentUser.uid;
    try {
        const q = query(collection(db, "orders"), where("client_id", "==", uid), where("status", "==", "completed"), orderBy("completed_at", "desc"));
        const snap = await getDocs(q);
        
        container.innerHTML = "";
        if(snap.empty) { container.innerHTML = `<p class="text-center text-xs text-gray-400 py-6">Histórico vazio.</p>`; return; }

        snap.forEach(d => {
            const order = d.data();
            const safeName = (order.provider_name || 'Prestador').replace(/'/g, "");
            container.innerHTML += `
                <div class="bg-gray-50 p-3 rounded-xl mb-2 border border-gray-100 flex justify-between items-center animate-fadeIn">
                    <div>
                        <p class="font-bold text-xs text-gray-700">${safeName}</p>
                        <p class="text-[10px] text-gray-400">${order.completed_at?.toDate().toLocaleDateString()}</p>
                    </div>
                    <div class="text-right">
                        <span class="block font-black text-green-600 text-xs">R$ ${order.offer_value}</span>
                        <button onclick="window.abrirModalAvaliacao('${d.id}', '${order.provider_id}', '${safeName}')" class="text-[9px] text-blue-600 font-bold underline cursor-pointer mt-1">Avaliar ⭐</button>
                    </div>
                </div>
            `;
        });
    } catch(e) { console.error(e); }
}

export function switchServiceSubTab(tabName) {
    ['contratar', 'andamento', 'historico'].forEach(t => {
        const view = document.getElementById(`view-${t}`);
        const btn = document.getElementById(`subtab-${t}-btn`);
        if(view) view.classList.add('hidden');
        if(btn) {
            btn.classList.remove('active', 'text-blue-900', 'border-blue-600');
            btn.classList.add('text-gray-400');
        }
    });
    
    const activeView = document.getElementById(`view-${tabName}`);
    const activeBtn = document.getElementById(`subtab-${tabName}-btn`);
    
    if(activeView) activeView.classList.remove('hidden');
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('active', 'text-blue-900', 'border-blue-600');
    }

    if(tabName === 'contratar') carregarServicos();
    if(tabName === 'andamento') carregarPedidosAtivos();
    if(tabName === 'historico') carregarHistorico();
}

// ============================================================================
// 3. GESTÃO DO PRESTADOR (PAINEL + ANTI-GOLPE)
// ============================================================================

export function switchProviderSubTab(tabName) {
    ['radar', 'ativos', 'historico'].forEach(t => {
        const view = document.getElementById(`pview-${t}`);
        const btn = document.getElementById(`ptab-${t}-btn`);
        if(view) view.classList.add('hidden');
        if(btn) btn.classList.remove('active', 'text-blue-900', 'border-blue-600');
    });
    
    const activeView = document.getElementById(`pview-${tabName}`);
    const activeBtn = document.getElementById(`ptab-${tabName}-btn`);
    
    if(activeView) activeView.classList.remove('hidden');
    if(activeBtn) activeBtn.classList.add('active', 'text-blue-900', 'border-blue-600');

    if(tabName === 'ativos') carregarPedidosPrestador();
    if(tabName === 'historico') carregarHistoricoPrestador();
}

// ⚠️ RENOMEADO CORRETAMENTE PARA EVITAR CONFLITO
async function carregarPedidosPrestador() {
    const container = document.getElementById('lista-chamados-ativos');
    if(!container) return;
    container.innerHTML = `<div class="loader mx-auto border-blue-500"></div>`;

    const uid = auth.currentUser.uid;
    const q = query(collection(db, "orders"), 
        where("provider_id", "==", uid), 
        where("status", "in", ["pending", "accepted", "in_progress"]), 
        orderBy("created_at", "desc")
    );

    const snap = await getDocs(q);
    container.innerHTML = "";

    if(snap.empty) { container.innerHTML = `<p class="text-center text-xs text-gray-400 py-4">Sem pedidos ativos.</p>`; return; }

    snap.forEach(d => {
        const order = d.data();
        let statusColor = order.status === 'in_progress' ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700";
        container.innerHTML += `
            <div onclick="window.abrirChatPedido('${d.id}')" class="bg-white p-3 rounded-xl border border-blue-100 shadow-sm mb-2 cursor-pointer flex justify-between items-center hover:bg-gray-50">
                <div>
                    <h3 class="font-bold text-xs text-gray-800">${order.client_name || 'Cliente'}</h3>
                    <p class="text-[10px] text-gray-500">${order.location || 'Local a combinar'}</p>
                </div>
                <div class="text-right">
                    <span class="block font-black text-green-600 text-xs">R$ ${order.offer_value}</span>
                    <span class="text-[8px] px-2 py-0.5 rounded-full ${statusColor} uppercase font-bold">${order.status}</span>
                </div>
            </div>
        `;
    });
}

// ⚠️ FUNÇÃO RESTAURADA
async function carregarHistoricoPrestador() {
    const container = document.getElementById('lista-chamados-historico');
    if(!container) return;
    container.innerHTML = `<div class="loader mx-auto border-blue-500"></div>`;

    const uid = auth.currentUser.uid;
    try {
        const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "completed"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        container.innerHTML = "";

        if(snap.empty) { container.innerHTML = `<p class="text-center text-xs text-gray-400 py-4">Nenhum serviço finalizado.</p>`; return; }

        snap.forEach(d => {
            const order = d.data();
            container.innerHTML += `
                <div class="bg-green-50 p-3 rounded-xl mb-2 border border-green-100 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-xs text-green-900">${order.client_name}</h3>
                        <p class="text-[10px] text-green-700">Concluído em ${order.completed_at?.toDate().toLocaleDateString()}</p>
                    </div>
                    <span class="font-black text-green-700 text-xs">+ R$ ${order.offer_value}</span>
                </div>
            `;
        });
    } catch(e) { console.error(e); }
}

export async function abrirConfiguracaoServicos() {
    const modal = document.getElementById('provider-setup-modal');
    const content = document.getElementById('provider-setup-content');
    if(!modal || !content) return;

    modal.classList.remove('hidden');
    
    // Lista serviços atuais
    const uid = auth.currentUser.uid;
    const docSnap = await getDoc(doc(db, "active_providers", uid));
    let currentHtml = "";
    
    if(docSnap.exists() && docSnap.data().services) {
        const servicos = docSnap.data().services;
        if(servicos.length > 0) {
            currentHtml = `<div class="bg-gray-50 p-3 rounded-xl mb-4 max-h-32 overflow-y-auto space-y-2 border border-gray-100 custom-scrollbar">
                <p class="text-[9px] font-bold text-gray-400 uppercase sticky top-0 bg-gray-50 z-10">Seus Serviços</p>
                ${servicos.map(s => `
                    <div class="flex justify-between items-center bg-white p-2 rounded border border-gray-200">
                        <span class="text-xs font-bold text-gray-700">${s.category}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-black text-green-600">R$ ${s.price}</span>
                            <button onclick="window.removerServico('${s.category}', ${s.price})" class="text-red-500 font-bold text-xs hover:bg-red-50 px-2 rounded">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        }
    }

    const options = CATEGORIAS_ATIVAS.map(c => `<option value="${c.label}" data-min="${c.minPrice}">${c.label} (Min: R$ ${c.minPrice})</option>`).join('');

    content.innerHTML = `
        <h3 class="text-lg font-black text-blue-900 uppercase mb-2 text-center">Gerenciar Serviços</h3>
        ${currentHtml}
        <div class="space-y-3 pt-2 border-t border-gray-100">
            <p class="text-[10px] font-bold text-blue-600 uppercase">Adicionar Novo</p>
            <div><select id="prov-cat" class="w-full border p-2 rounded-lg text-sm bg-white" onchange="window.atualizarMinimo(this)">${options}</select></div>
            <div>
                <input type="number" id="prov-price" class="w-full border p-2 rounded-lg text-sm font-bold text-green-600" placeholder="0.00">
                <p id="msg-min-price" class="text-[9px] text-red-500 mt-1 font-bold hidden"></p>
            </div>
            <button onclick="salvarServicoPrestador()" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg">ADICIONAR SERVIÇO</button>
        </div>
    `;
    setTimeout(() => {
        const select = document.getElementById('prov-cat');
        if(select) window.atualizarMinimo(select);
    }, 100);
}

// ⚠️ FUNÇÃO RESTAURADA
window.removerServico = async (cat, price) => {
    if(!confirm(`Remover ${cat}?`)) return;
    try {
        await updateDoc(doc(db, "active_providers", auth.currentUser.uid), {
            services: arrayRemove({ category: cat, price: price, status: 'ativo' })
        });
        abrirConfiguracaoServicos(); 
    } catch(e) { alert("Erro ao remover."); }
};

window.atualizarMinimo = (select) => {
    const min = select.options[select.selectedIndex].dataset.min;
    const msg = document.getElementById('msg-min-price');
    document.getElementById('prov-price').placeholder = `Mínimo: R$ ${min}`;
    msg.innerText = `⚠️ Mínimo sugerido: R$ ${min},00`;
    msg.classList.remove('hidden');
};

// ⚠️ FUNÇÃO RESTAURADA
export async function salvarServicoPrestador() {
    const user = auth.currentUser;
    const select = document.getElementById('prov-cat');
    const priceInput = document.getElementById('prov-price');
    
    if(!select || !priceInput) return;

    const category = select.value;
    const price = parseFloat(priceInput.value);
    const minPrice = parseFloat(select.options[select.selectedIndex].dataset.min);

    if(isNaN(price) || price < minPrice) {
        alert(`⛔ Preço muito baixo!\nO mínimo para ${category} é R$ ${minPrice},00.`);
        return;
    }

    try {
        const ref = doc(db, "active_providers", user.uid);
        const newService = { category, price, status: 'ativo' };
        
        try {
            await updateDoc(ref, { services: arrayUnion(newService), is_online: true });
        } catch(e) {
            await setDoc(ref, { uid: user.uid, nome: user.displayName, services: [newService], is_online: true, rating_avg: 5.0, status: 'aprovado' });
        }
        alert("✅ Serviço salvo!");
        abrirConfiguracaoServicos();
    } catch(e) { 
        alert("Erro ao salvar: " + e.message); 
    }
}

// --- EXPORTAÇÕES GLOBAIS (ESSENCIAL PARA O HTML FUNCIONAR) ---
window.carregarServicos = carregarServicos;
window.filtrarServicos = (cat) => carregarServicos(cat);
window.switchServiceSubTab = switchServiceSubTab;
window.carregarPedidosAtivos = carregarPedidosAtivos; // ✅ RESTAURADO
window.carregarHistorico = carregarHistorico; // ✅ RESTAURADO
window.switchProviderSubTab = switchProviderSubTab;
window.abrirConfiguracaoServicos = abrirConfiguracaoServicos;
window.salvarServicoPrestador = salvarServicoPrestador; // ✅ RESTAURADO
// ALIAS DE SEGURANÇA (Para o request.js achar)
window.iniciarMonitoramentoPedidos = carregarPedidosPrestador;
