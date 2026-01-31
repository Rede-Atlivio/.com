import { db, auth } from '../app.js';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 📌 CATEGORIAS E VALORES MÍNIMOS (ANTI-GOLPE)
export const CATEGORIAS_ATIVAS = [
    { id: 'eventos', label: '🍸 Eventos & Festas', icon: '🍸', minPrice: 120 }, // Garçom base
    { id: 'residenciais', label: '🏠 Serviços Residenciais', icon: '🏠', minPrice: 150 }, // Eletricista base
    { id: 'limpeza', label: '🧹 Limpeza & Organização', icon: '🧹', minPrice: 130 }, // Diarista base
    { id: 'transporte', label: '🚗 Transporte (Uber/99/Frete)', icon: '🚗', minPrice: 60 }, // Motoboy base
    { id: 'musica', label: '🎵 Música & Entretenimento', icon: '🎵', minPrice: 250 }, // Músico solo base
    { id: 'audiovisual', label: '📸 Audiovisual & Criação', icon: '📸', minPrice: 300 }, // Social Media base
    { id: 'tecnologia', label: '💻 Tecnologia & Digital', icon: '💻', minPrice: 150 }, // Suporte base
    { id: 'aulas', label: '🧑‍🏫 Aulas & Educação', icon: '🧑‍🏫', minPrice: 80 }, // Aula base
    { id: 'beleza', label: '💆 Saúde & Beleza', icon: '💆', minPrice: 100 }, // Massagem base
    { id: 'pets', label: '🐶 Pets & Cuidados', icon: '🐶', minPrice: 50 }, // Passeio base
    { id: 'aluguel', label: '🏗 Aluguel de Itens', icon: '🏗', minPrice: 150 }, // Mesas base
    { id: 'gerais', label: '🤝 Serviços Gerais / Bicos', icon: '🤝', minPrice: 100 } // Ajudante base
];

let servicesUnsubscribe = null;

// ============================================================================
// 1. VITRINE (LEITURA)
// ============================================================================
export async function carregarServicos(filtroCategoria = null) {
    const container = document.getElementById('lista-prestadores-realtime') || document.getElementById('lista-servicos');
    const containerFiltros = document.getElementById('category-filters');
    
    if (!container) return;

    if(containerFiltros && containerFiltros.innerHTML.trim() === "") {
        containerFiltros.innerHTML = `
            <div class="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                <button onclick="window.filtrarServicos('todos')" class="bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-md hover:bg-blue-600 transition">Todos</button>
                ${CATEGORIAS_ATIVAS.map(cat => `
                    <button onclick="window.filtrarServicos('${cat.label}')" class="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-blue-50 hover:border-blue-200 transition">
                        ${cat.icon} ${cat.label.split(' ')[1]}...
                    </button>
                `).join('')}
            </div>
        `;
        containerFiltros.classList.remove('hidden');
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

        servicos.sort((a, b) => {
            if (a.is_demo !== b.is_demo) return a.is_demo ? 1 : -1;
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

function renderizarCards(servicos, container) {
    container.innerHTML = "";

    if (servicos.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 opacity-60">
                <div class="text-4xl mb-2">🤷‍♂️</div>
                <h3 class="font-bold text-gray-600">Nenhum profissional nesta categoria.</h3>
                <button onclick="window.abrirPerfilProfissional()" class="mt-4 text-blue-600 font-bold text-xs underline">Quero Trabalhar Aqui</button>
            </div>`;
        return;
    }

    servicos.forEach(user => {
        const temServicos = user.services && Array.isArray(user.services) && user.services.length > 0;
        const mainService = temServicos ? user.services[0] : { category: 'Geral', price: 'A Combinar' };
        
        const nomeProf = user.nome_profissional || user.nome || "Prestador";
        const precoDisplay = mainService.price ? `R$ ${mainService.price}` : 'A Combinar';
        const categoriaDisplay = mainService.category || 'Serviços Gerais';

        const isOnline = user.is_online === true;
        const grayscaleClass = isOnline ? "" : "grayscale opacity-75";
        const statusDot = isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400";
        const statusText = isOnline ? "Online Agora" : "Indisponível";
        const coverImg = user.cover_image || 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=500&q=60';
        
        const rating = user.rating_avg || 5.0;
        const ratingCount = user.rating_count || 0;
        const starsHtml = "⭐".repeat(Math.floor(rating));

        let btnTexto = "SOLICITAR SERVIÇO";
        let btnAcao = `window.abrirModalSolicitacao('${user.id}', '${nomeProf}', '${mainService.price || 0}')`;
        let demoBadge = "";

        if (user.is_demo) {
            btnTexto = "VER EXEMPLO";
            btnAcao = "alert('Este é um perfil demonstrativo.')";
            demoBadge = `<div class="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[9px] font-black px-2 py-1 rounded uppercase shadow-sm z-10">Demonstração</div>`;
        }

        container.innerHTML += `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative ${grayscaleClass} transition-all duration-300 hover:shadow-md animate-fadeIn flex flex-col h-full">
                ${demoBadge}
                <div onclick="window.verPerfilCompleto('${user.id}')" class="h-28 bg-gray-200 relative cursor-pointer group">
                    <img src="${coverImg}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="Capa">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div class="absolute bottom-2 left-3 flex items-center gap-2">
                        <img src="${user.foto_perfil || 'https://ui-avatars.com/api/?name='+nomeProf}" class="w-10 h-10 rounded-full border-2 border-white shadow-md bg-white object-cover">
                        <div>
                            <h3 class="text-white font-bold text-xs leading-tight text-shadow line-clamp-1">${nomeProf}</h3>
                            <div class="flex items-center gap-1 text-[8px] text-yellow-300">
                                <span>${starsHtml}</span> <span class="text-white/80">(${ratingCount})</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="p-3 flex flex-col flex-1 justify-between">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1 pr-1">
                            <p class="text-[10px] font-bold text-gray-600 uppercase truncate max-w-[150px]">${categoriaDisplay}</p>
                            <p class="text-[9px] text-gray-400 line-clamp-1">${user.bio || 'Pronto para atender.'}</p>
                        </div>
                        <div class="text-right whitespace-nowrap">
                            <span class="block font-black text-green-600 text-xs">${precoDisplay}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 pt-2 border-t border-gray-50 mt-auto">
                        <div class="flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full ${statusDot}"></span>
                        </div>
                        <button onclick="${btnAcao}" class="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg hover:bg-slate-800 transition active:scale-95 flex-1 whitespace-nowrap">
                            ${btnTexto}
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

// ============================================================================
// 2. MEUS PEDIDOS & HISTÓRICO
// ============================================================================
export async function carregarPedidosAtivos() {
    const container = document.getElementById('meus-pedidos-andamento');
    if (!container || !auth.currentUser) return;

    container.innerHTML = `<div class="loader mx-auto border-blue-200 border-t-blue-600 mt-2"></div>`;
    
    const uid = auth.currentUser.uid;
    const q1 = query(collection(db, "orders"), where("client_id", "==", uid), orderBy("created_at", "desc"));
    
    onSnapshot(q1, (snap) => {
        container.innerHTML = "";
        let pedidos = [];
        snap.forEach(d => {
            const p = d.data();
            if(p.status !== 'completed' && p.status !== 'rejected') pedidos.push({id: d.id, ...p});
        });

        if (pedidos.length === 0) {
            container.innerHTML = `<div class="text-center py-6 opacity-50"><p class="text-xs text-gray-400">Nenhum pedido ativo.</p></div>`;
            return;
        }

        pedidos.forEach(pedido => {
            let statusLabel = "Pendente";
            if(pedido.status === 'in_progress') statusLabel = "Em Andamento";
            if(pedido.status === 'accepted') statusLabel = "Aceito";

            container.innerHTML += `
                <div onclick="window.abrirChatPedido('${pedido.id}')" class="bg-white p-3 rounded-xl border border-blue-100 shadow-sm mb-2 cursor-pointer hover:bg-blue-50 flex justify-between items-center animate-fadeIn">
                    <div>
                        <h3 class="font-bold text-gray-800 text-sm">${pedido.provider_name}</h3>
                        <p class="text-[10px] text-gray-500 mt-1">R$ ${pedido.offer_value} • ${statusLabel}</p>
                    </div>
                    <span class="text-xl">💬</span>
                </div>
            `;
        });
    });
}

export function switchServiceSubTab(tabName) {
    ['contratar', 'andamento', 'historico'].forEach(t => {
        document.getElementById(`view-${t}`).classList.add('hidden');
        document.getElementById(`subtab-${t}-btn`).classList.remove('active', 'text-blue-900', 'border-blue-600');
        document.getElementById(`subtab-${t}-btn`).classList.add('text-gray-400');
    });

    const viewAlvo = document.getElementById(`view-${tabName}`);
    const btnAlvo = document.getElementById(`subtab-${tabName}-btn`);
    
    if(viewAlvo) viewAlvo.classList.remove('hidden');
    if(btnAlvo) {
        btnAlvo.classList.add('active', 'text-blue-900', 'border-blue-600');
        btnAlvo.classList.remove('text-gray-400');
    }

    if(tabName === 'contratar') carregarServicos();
    if(tabName === 'andamento') carregarPedidosAtivos();
    if(tabName === 'historico') carregarHistorico();
}

async function carregarHistorico() {
    const container = document.getElementById('meus-pedidos-historico');
    if(!container) return;
    container.innerHTML = `<div class="loader mx-auto border-blue-500 mt-2"></div>`;

    const uid = auth.currentUser.uid;
    
    try {
        const q = query(collection(db, "orders"), 
            where("client_id", "==", uid), 
            where("status", "==", "completed"),
            orderBy("completed_at", "desc")
        );

        const snap = await getDocs(q);
        container.innerHTML = "";
        
        if(snap.empty) {
            container.innerHTML = `<p class="text-center text-xs text-gray-400 py-6">Nenhum serviço finalizado.</p>`;
            return;
        }

        snap.forEach(d => {
            const order = d.data();
            
            // CORREÇÃO BOTÃO AVALIAR
            // Passamos strings seguras (sem aspas dentro)
            const safeName = (order.provider_name || 'Prestador').replace(/'/g, "");
            
            container.innerHTML += `
                <div class="bg-gray-50 p-3 rounded-xl mb-2 border border-gray-100 flex justify-between items-center animate-fadeIn">
                    <div>
                        <p class="font-bold text-xs text-gray-700">${safeName}</p>
                        <p class="text-[10px] text-gray-400">${order.completed_at?.toDate().toLocaleDateString()}</p>
                    </div>
                    <div class="text-right">
                        <span class="block font-black text-green-600 text-xs">R$ ${order.offer_value}</span>
                        <button onclick="window.abrirModalAvaliacao('${d.id}', '${order.provider_id}', '${safeName}')" class="text-[9px] text-blue-600 font-bold underline hover:text-blue-800 cursor-pointer p-1">
                            Avaliar ⭐
                        </button>
                    </div>
                </div>
            `;
        });
    } catch(e) {
        console.error("Erro histórico:", e);
        container.innerHTML = `<p class="text-red-500 text-xs">Erro ao carregar.</p>`;
    }
}

// ============================================================================
// 3. EDITOR DE SERVIÇOS DO PRESTADOR (COM PREÇO MÍNIMO)
// ============================================================================
export function abrirConfiguracaoServicos() {
    const modal = document.getElementById('provider-setup-modal');
    const content = document.getElementById('provider-setup-content');
    modal.classList.remove('hidden');
    
    const options = CATEGORIAS_ATIVAS.map(c => `<option value="${c.label}" data-min="${c.minPrice}">${c.label} (Min: R$ ${c.minPrice})</option>`).join('');

    content.innerHTML = `
        <h3 class="text-lg font-black text-blue-900 uppercase mb-4 text-center">Configurar Serviços</h3>
        <div class="space-y-4">
            <div>
                <label class="text-[10px] font-bold text-gray-500 uppercase">Categoria Principal</label>
                <select id="prov-cat" class="w-full border p-2 rounded-lg text-sm bg-white" onchange="window.atualizarMinimo(this)">
                    ${options}
                </select>
            </div>
            <div>
                <label class="text-[10px] font-bold text-gray-500 uppercase">Preço Base (R$)</label>
                <input type="number" id="prov-price" class="w-full border p-2 rounded-lg text-sm font-bold text-green-600" placeholder="0.00">
                <p id="msg-min-price" class="text-[9px] text-red-500 mt-1 font-bold hidden"></p>
            </div>
            <button onclick="salvarServicoPrestador()" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg">SALVAR SERVIÇO</button>
        </div>
    `;
}

// Helper para mostrar preço mínimo
window.atualizarMinimo = (select) => {
    const min = select.options[select.selectedIndex].dataset.min;
    const input = document.getElementById('prov-price');
    const msg = document.getElementById('msg-min-price');
    
    input.placeholder = `Mínimo: ${min}`;
    msg.innerText = `⚠️ Valor mínimo para esta categoria: R$ ${min},00`;
    msg.classList.remove('hidden');
};

export async function salvarServicoPrestador() {
    const user = auth.currentUser;
    if(!user) return;

    const select = document.getElementById('prov-cat');
    const priceInput = document.getElementById('prov-price');
    
    const category = select.value;
    const price = parseFloat(priceInput.value);
    const minPrice = parseFloat(select.options[select.selectedIndex].dataset.min);

    // 🛡️ TRAVA ANTI-GOLPE
    if(isNaN(price) || price < minPrice) {
        alert(`⛔ VALOR INVÁLIDO!\n\nPara manter a qualidade da plataforma e evitar fraudes, o valor mínimo para ${category} é R$ ${minPrice},00.`);
        priceInput.value = minPrice;
        return;
    }

    try {
        const newService = { category, price, status: 'ativo' };
        
        // Atualiza Active Providers
        const ref = doc(db, "active_providers", user.uid);
        // Primeiro tenta criar se não existir, ou atualizar
        try {
            await updateDoc(ref, { 
                services: arrayUnion(newService),
                is_online: true 
            });
        } catch(e) {
            // Se der erro (doc não existe), cria
            const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            await setDoc(ref, {
                uid: user.uid,
                nome: user.displayName,
                services: [newService],
                is_online: true,
                rating_avg: 5.0,
                status: 'aprovado'
            });
        }

        alert("✅ Serviço adicionado com sucesso!");
        document.getElementById('provider-setup-modal').classList.add('hidden');
        location.reload(); // Recarrega para ver na vitrine

    } catch(e) {
        console.error(e);
        alert("Erro ao salvar serviço.");
    }
}

// EXPORTAÇÕES GLOBAIS
window.carregarServicos = carregarServicos;
window.filtrarServicos = (cat) => carregarServicos(cat);
window.switchServiceSubTab = switchServiceSubTab;
window.carregarPedidosAtivos = carregarPedidosAtivos;
window.abrirConfiguracaoServicos = abrirConfiguracaoServicos;
window.salvarServicoPrestador = salvarServicoPrestador;
