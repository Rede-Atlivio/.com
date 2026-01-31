import { db, auth } from '../app.js';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 📌 NOVAS CATEGORIAS
export const CATEGORIAS_ATIVAS = [
    { id: 'eventos', label: '🍸 Eventos & Festas', icon: '🍸' },
    { id: 'residenciais', label: '🏠 Serviços Residenciais', icon: '🏠' },
    { id: 'limpeza', label: '🧹 Limpeza & Organização', icon: '🧹' },
    { id: 'transporte', label: '🚗 Transporte (Uber/99/Frete)', icon: '🚗' },
    { id: 'musica', label: '🎵 Música & Entretenimento', icon: '🎵' },
    { id: 'audiovisual', label: '📸 Audiovisual & Criação', icon: '📸' },
    { id: 'tecnologia', label: '💻 Tecnologia & Digital', icon: '💻' },
    { id: 'aulas', label: '🧑‍🏫 Aulas & Educação', icon: '🧑‍🏫' },
    { id: 'beleza', label: '💆 Saúde & Beleza', icon: '💆' },
    { id: 'pets', label: '🐶 Pets & Cuidados', icon: '🐶' },
    { id: 'aluguel', label: '🏗 Aluguel de Itens', icon: '🏗' },
    { id: 'gerais', label: '🤝 Serviços Gerais / Bicos', icon: '🤝' }
];

let servicesUnsubscribe = null;

// ============================================================================
// 1. VITRINE (OFERTA)
// ============================================================================
export async function carregarServicos(filtroCategoria = null) {
    const container = document.getElementById('lista-servicos');
    const containerFiltros = document.getElementById('filtros-servicos');
    
    if (!container) return;

    // Renderiza Filtros se necessário
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
    }

    container.innerHTML = `<div class="loader mx-auto border-blue-500"></div>`;

    let q = query(collection(db, "active_providers"), where("status", "==", "aprovado"));

    if (servicesUnsubscribe) servicesUnsubscribe();

    servicesUnsubscribe = onSnapshot(q, (snapshot) => {
        let servicos = [];
        snapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id;
            servicos.push(data);
        });

        // Ordenação Inteligente: Reais > Avaliados > Demos
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
            <div class="text-center py-12 opacity-60">
                <div class="text-4xl mb-2">🤷‍♂️</div>
                <h3 class="font-bold text-gray-600">Nenhum profissional nesta categoria.</h3>
                <button onclick="window.abrirPerfilProfissional()" class="mt-4 text-blue-600 font-bold text-xs underline">Quero Trabalhar Aqui</button>
            </div>`;
        return;
    }

    servicos.forEach(user => {
        const isOnline = user.is_online === true;
        const grayscaleClass = isOnline ? "" : "grayscale opacity-75";
        const statusDot = isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400";
        const statusText = isOnline ? "Online Agora" : "Indisponível";
        const coverImg = user.cover_image || 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=500&q=60';
        
        const rating = user.rating_avg || 5.0;
        const ratingCount = user.rating_count || 0;
        const starsHtml = "⭐".repeat(Math.floor(rating));

        let btnTexto = "SOLICITAR SERVIÇO";
        let btnAcao = `window.abrirModalSolicitacao('${user.id}', '${user.nome_profissional || user.nome}', '${user.services[0]?.price || 0}')`;
        let demoBadge = "";

        if (user.is_demo) {
            btnTexto = "VER EXEMPLO";
            btnAcao = "alert('Este é um perfil demonstrativo.')";
            demoBadge = `<div class="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[9px] font-black px-2 py-1 rounded uppercase shadow-sm z-10">Demonstração</div>`;
        }

        const mainService = user.services && user.services.length > 0 ? user.services[0] : { category: 'Geral', price: 'A Combinar' };

        container.innerHTML += `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4 relative ${grayscaleClass} transition-all duration-300 hover:shadow-md">
                ${demoBadge}
                <div onclick="window.verPerfilCompleto('${user.id}')" class="h-24 bg-gray-200 relative cursor-pointer group">
                    <img src="${coverImg}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="Capa">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div class="absolute bottom-2 left-3 flex items-center gap-2">
                        <img src="${user.foto_perfil || 'https://ui-avatars.com/api/?name='+user.nome}" class="w-10 h-10 rounded-full border-2 border-white shadow-md bg-white object-cover">
                        <div>
                            <h3 class="text-white font-bold text-sm leading-tight text-shadow">${user.nome_profissional || user.nome}</h3>
                            <div class="flex items-center gap-1 text-[10px] text-yellow-300">
                                <span>${starsHtml}</span> <span class="text-white/80">(${ratingCount})</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <p class="text-xs font-bold text-gray-600 uppercase">${mainService.category}</p>
                            <p class="text-[10px] text-gray-400 line-clamp-1">${user.bio || 'Pronto para atender.'}</p>
                        </div>
                        <div class="text-right">
                            <span class="block font-black text-green-600 text-sm">R$ ${mainService.price}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                        <div class="flex items-center gap-1.5 flex-1">
                            <span class="w-2 h-2 rounded-full ${statusDot}"></span>
                            <span class="text-[10px] font-bold text-gray-500 uppercase">${statusText}</span>
                        </div>
                        <button onclick="${btnAcao}" class="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg hover:bg-slate-800 transition active:scale-95 flex-1">
                            ${btnTexto}
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

// ============================================================================
// 2. MEUS PEDIDOS (RESTAURADO) - CRUCIAL PARA A ABA 'EM ANDAMENTO'
// ============================================================================
export async function carregarPedidosAtivos() {
    const container = document.getElementById('lista-pedidos-render');
    if (!container || !auth.currentUser) return;

    container.innerHTML = `<div class="loader mx-auto border-blue-200 border-t-blue-600 mt-10"></div>`;
    
    // Busca pedidos onde sou cliente ou prestador (status != completed)
    // Nota: Simplificando query para evitar erro de índice composto complexo.
    // Buscamos tudo onde participo e filtro no cliente por status.
    const uid = auth.currentUser.uid;
    const q1 = query(collection(db, "orders"), where("client_id", "==", uid), orderBy("created_at", "desc"));
    
    // Obs: Idealmente faríamos duas queries e uníamos, mas vamos focar no cliente ver seus pedidos.
    
    onSnapshot(q1, (snap) => {
        container.innerHTML = "";
        let pedidos = [];
        snap.forEach(d => {
            const p = d.data();
            if(p.status !== 'completed' && p.status !== 'rejected') pedidos.push({id: d.id, ...p});
        });

        if (pedidos.length === 0) {
            container.innerHTML = `<div class="text-center py-10 opacity-50"><p class="text-xs text-gray-400">Nenhum pedido ativo.</p></div>`;
            return;
        }

        pedidos.forEach(pedido => {
            // Reutiliza lógica de card de pedido existente no seu chat.js se houver, 
            // ou renderiza simples aqui para garantir que aparece.
            let statusLabel = "Pendente";
            if(pedido.status === 'in_progress') statusLabel = "Em Andamento";
            if(pedido.status === 'accepted') statusLabel = "Aceito - Aguardando";

            container.innerHTML += `
                <div onclick="window.abrirChatPedido('${pedido.id}')" class="bg-white p-3 rounded-xl border border-blue-100 shadow-sm mb-2 cursor-pointer hover:bg-blue-50">
                    <div class="flex justify-between">
                        <h3 class="font-bold text-gray-800 text-sm">${pedido.provider_name}</h3>
                        <span class="text-[10px] bg-blue-100 text-blue-700 px-2 rounded-full">${statusLabel}</span>
                    </div>
                    <p class="text-[10px] text-gray-500 mt-1">R$ ${pedido.offer_value} • Toque para ver</p>
                </div>
            `;
        });
    });
}

// ============================================================================
// 3. NAVEGAÇÃO INTERNA (Abas Pedidos/Histórico)
// ============================================================================
export function switchServiceSubTab(tabName) {
    const painelPedidos = document.getElementById('painel-pedidos');
    const painelHistorico = document.getElementById('painel-historico');
    
    // Remove active
    document.querySelectorAll('.subtab-btn').forEach(b => {
        b.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        b.classList.add('text-gray-400');
    });

    if(tabName === 'andamento') {
        if(painelPedidos) painelPedidos.classList.remove('hidden');
        if(painelHistorico) painelHistorico.classList.add('hidden');
        
        const btn = document.getElementById('btn-tab-andamento');
        if(btn) btn.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        
        carregarPedidosAtivos();
    } else {
        if(painelPedidos) painelPedidos.classList.add('hidden');
        if(painelHistorico) painelHistorico.classList.remove('hidden');
        
        const btn = document.getElementById('btn-tab-historico');
        if(btn) btn.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        
        carregarHistorico();
    }
}

async function carregarHistorico() {
    const container = document.getElementById('lista-historico-render');
    if(!container) return;
    container.innerHTML = `<div class="loader mx-auto"></div>`;

    const uid = auth.currentUser.uid;
    const q = query(collection(db, "orders"), 
        where("client_id", "==", uid), 
        where("status", "==", "completed"),
        orderBy("completed_at", "desc")
    );

    const snap = await getDocs(q);
    container.innerHTML = "";
    
    if(snap.empty) {
        container.innerHTML = `<p class="text-center text-xs text-gray-400 py-4">Nenhum serviço finalizado.</p>`;
        return;
    }

    snap.forEach(d => {
        const order = d.data();
        // Botão para avaliar
        container.innerHTML += `
            <div class="bg-gray-50 p-3 rounded-xl mb-2 border border-gray-100">
                <div class="flex justify-between items-center mb-2">
                    <p class="font-bold text-xs text-gray-700">${order.provider_name}</p>
                    <span class="font-black text-green-600 text-xs">R$ ${order.offer_value}</span>
                </div>
                <div class="flex justify-between items-center">
                    <p class="text-[10px] text-gray-400">${order.completed_at?.toDate().toLocaleDateString()}</p>
                    <button onclick="window.abrirModalAvaliacao('${d.id}', '${order.provider_id}', '${order.provider_name}')" class="text-[10px] text-blue-600 font-bold underline">Avaliar ⭐</button>
                </div>
            </div>
        `;
    });
}

// ============================================================================
// 4. EXPORTAÇÕES GLOBAIS (ESSENCIAL PARA O HTML FUNCIONAR)
// ============================================================================
window.carregarServicos = carregarServicos;
window.filtrarServicos = (cat) => carregarServicos(cat);
window.switchServiceSubTab = switchServiceSubTab;
window.carregarPedidosAtivos = carregarPedidosAtivos;
// Alias para compatibilidade antiga
window.iniciarMonitoramentoPedidos = carregarPedidosAtivos;
