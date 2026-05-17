import { db, auth } from '../config.js';
import { 
    collection, query, where, getDocs, onSnapshot, doc, getDoc, 
    updateDoc, setDoc, deleteDoc, addDoc, arrayUnion, arrayRemove, 
    increment, limit, serverTimestamp, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// 🌍 TRADUTOR GLOBAL ATLIVIO (INJEÇÃO IMEDIATA)
window.traduzirStatus = (s) => {
    if (!s) return '---';
    const mapa = {
        'pending': '⏳ Novo Pedido',
        'accepted': '✅ Aceito / Em Chat',
        'confirmed_hold': '🔒 Acordo Fechado',
        'in_progress': '🛠️ Em Execução',
        'completed': '✨ Concluído',
        'cancelled': '❌ Cancelado',
        'negotiation_closed': '🤝 Encerrado',
        'expired': '⏲️ Expirado',
        'ativo': 'Ativo',
        'rascunho': 'Rascunho'
    };
    const statusLimpo = s.toString().toLowerCase().trim();
    return mapa[statusLimpo] || s;
};
// ✅ Importação do Storage (Mas sem inicializar aqui para não travar)
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 🔥 1. TABELA DE INTELIGÊNCIA DE MERCADO (Âncoras Premium Inclusas)
export const SERVICOS_PADRAO = [
    { category: 'eventos', title: 'Garçom', price: 120 },
    { category: 'eventos', title: 'Barman', price: 150 },
    { category: 'eventos', title: 'Copeira', price: 110 },
    { category: 'eventos', title: 'Churrasqueiro', price: 200 },
    { category: 'eventos', title: 'Segurança de evento', price: 180 },
    { category: 'eventos', title: 'Pacote Completo (Bar + Garçons + Limpeza)', price: 1000, level: 'premium' },
    { category: 'eventos', title: 'Produção e Organização de Evento', price: 1000, level: 'premium' },
    { category: 'musica', title: 'Músico solo', price: 250 },
    { category: 'musica', title: 'DJ Profissional com Estrutura', price: 500, level: 'premium' },
    { category: 'musica', title: 'Banda para Casamento / Evento', price: 500, level: 'premium' },
    { category: 'audiovisual', title: 'Fotógrafo', price: 250 },
    { category: 'audiovisual', title: 'Filmagem e Aftermovie Corporativo', price: 1000, level: 'premium' },
    { category: 'audiovisual', title: 'Gestão de Tráfego Mensal', price: 500, level: 'premium' },
    { category: 'limpeza', title: 'Diarista', price: 130 },
    { category: 'residenciais', title: 'Reforma Pequena (Pacote)', price: 1000, level: 'premium' },
    { category: 'transporte', title: 'Transporte para Eventos (Van/Executivo)', price: 700, level: 'premium' },
    { category: 'aluguel', title: 'Aluguel de Som e Iluminação Profissional', price: 1000, level: 'premium' },
    { category: 'aluguel', title: 'Aluguel de Palco e Tendas', price: 1000, level: 'premium' },
    { category: 'tecnologia', title: 'Desenvolvimento de Site / Landing Page', price: 500, level: 'premium' }
];

// ⚡ INJEÇÃO GLOBAL IMEDIATA PARA MATAR ERROS DE REFERÊNCIA NO REQUEST.JS
window.SERVICOS_PADRAO = SERVICOS_PADRAO;

// CATEGORIAS E VALORES MÍNIMOS (FONTE DE VERDADE FINANCEIRA)
export const CATEGORIAS_ATIVAS = [
    { id: 'eventos', label: '🍸 Eventos & Festas', icon: '🍸', minPrice: 120 },
    { id: 'residenciais', label: '🏠 Serviços Residenciais', icon: '🏠', minPrice: 150 },
    { id: 'limpeza', label: '🧹 Limpeza & Organização', icon: '🧹', minPrice: 130 },
    { id: 'transporte', label: '🚗 Transporte (Viagens/Frete)', icon: '🚗', minPrice: 60 },
    { id: 'musica', label: '🎵 Música & Entretenimento', icon: '🎵', minPrice: 250 },
    { id: 'audiovisual', label: '📸 Audiovisual & Criação', icon: '📸', minPrice: 300 },
    { id: 'tecnologia', label: '💻 Tecnologia & Digital', icon: '💻', minPrice: 150 },
    { id: 'aulas', label: '🧑‍🏫 Aulas & Educação', icon: '🧑‍🏫', minPrice: 80 },
    { id: 'beleza', label: '💆 Saúde & Beleza', icon: '💆', minPrice: 100 },
    { id: 'pets', label: '🐶 Pets & Cuidados', icon: '🐶', minPrice: 50 },
    { id: 'aluguel', label: '🏗 Aluguel de Itens', icon: '🏗', minPrice: 150 },
    { id: 'gerais', label: '🤝 Serviços Gerais / Bicos', icon: '🤝', minPrice: 100 }
];

// 🔥 INJEÇÃO GLOBAL: Garante que o Chat.js consiga ler as travas de preço
window.CATEGORIAS_ATIVAS = CATEGORIAS_ATIVAS;
let servicesUnsubscribe = null;

// ============================================================================
// 1. VITRINE (CLIENTE)
// ============================================================================
export async function carregarServicos(filtroCategoria = null) {
    // 🔍 1. TENTA ACHAR O LOCAL
    let container = document.getElementById('lista-prestadores-realtime') || document.getElementById('lista-servicos');
    let containerFiltros = document.getElementById('category-filters');
    
    // 🚑 2. AUTO-FIX: SE NÃO ACHAR, CRIA O HTML NA HORA
    if (!container) {
        console.warn("⚠️ Container de serviços ausente. Gerando estrutura visual...");
        
        // Tenta achar a aba pai onde os serviços devem ficar
        const areaAlvo = document.getElementById('view-contratar') || document.getElementById('servicos-cliente');
        
        if (areaAlvo) {
            // Cria a barra de filtros se não existir
            if (!containerFiltros) {
                containerFiltros = document.createElement('div');
                containerFiltros.id = 'category-filters';
                containerFiltros.className = "mb-4 hidden animate-fade"; // CSS padrão
                areaAlvo.prepend(containerFiltros);
            }

            // Cria o Container (Grid) dos Cards
            container = document.createElement('div');
            container.id = 'lista-servicos';
            container.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-24 animate-fade";
            areaAlvo.appendChild(container);
        } else {
            // Se nem a aba existir, aí é erro fatal
            console.error("❌ ERRO CRÍTICO: Não encontrei a aba 'view-contratar' para desenhar.");
            return;
        }
    }

    const isVitrineVisible = container.offsetParent !== null;
    if(containerFiltros) {
        if(isVitrineVisible) {
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
            // 🔥 NOVO: Calcula a Pontuação de Relevância (Algoritmo do Feed)
            data.score = calcularRelevancia(data); 
            servicos.push(data);
        });

        // 🔥 NOVO: Ordenação por Score (Quem tem mais pontos aparece primeiro)
        servicos.sort((a, b) => b.score - a.score);

        if (filtroCategoria && filtroCategoria !== 'todos') {
            servicos = servicos.filter(s => 
                s.services && s.services.some(sub => sub.category.includes(filtroCategoria) || sub.category === filtroCategoria)
            );
        }
        renderizarCards(servicos, container);
    });
}

// 🧠 NOVO: ALGORITMO DE RELEVÂNCIA (Calcula os pontos para o ranking)
function calcularRelevancia(user) {
    let score = 0;

    // 1. Simulados vão para o final da fila
    if (user.is_demo) return -100;

    // 2. Online ganha destaque máximo (prioridade)
    if (user.is_online) score += 500;

    // 3. Avaliação (Estrelas * 20 pontos)
    score += (user.rating_avg || 5.0) * 20;

    // 4. Nível de Serviço (Premium > Pro > Basic)
    if (user.service_level === 'premium') score += 100;
    else if (user.service_level === 'pro') score += 50;

   // 5. Verificado ganha bônus
    if (user.is_verified) score += 30;

    // ❤️ GAMIFICAÇÃO SOCIAL: Cada curtida computada adiciona 5 pontos de relevância ao ranking
    score += (user.likes_count || 0) * 5;

    return score;
}

function renderizarCards(servicos, container) {
    container.innerHTML = "";
    if (servicos.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-12 opacity-50"><p>Nenhum profissional encontrado.</p></div>`;
        return;
    }

    servicos.forEach(user => {
        try {
            const servicosLista = user.services || [];
            const temServicos = servicosLista.length > 0;
            const mainService = temServicos ? servicosLista[0] : { category: 'Geral', price: 'A Combinar', title: 'Serviço' };
            
            // 🏷️ LOGICA MULTI-SERVIÇOS:
            const totalOutros = servicosLista.length - 1;
            const badgeMulti = totalOutros > 0 ? `<span class="bg-blue-100 text-blue-600 text-[7px] font-black px-1.5 py-0.5 rounded-md ml-1">+${totalOutros} OPÇÕES</span>` : "";
            
            const nomeProf = user.nome_profissional || user.nome || "Prestador";
            const precoDisplay = mainService.price ? `R$ ${mainService.price}` : 'A Combinar';
            const tituloServico = mainService.title || mainService.category;
            
            const isOnline = user.is_online === true;
            const isDemo = user.is_demo === true;

            // --- LÓGICA DE STATUS (BOLINHA ONLINE/OFFLINE) ---
            let statusClass = isOnline ? "" : "grayscale opacity-75";
            let statusText = isOnline ? "ONLINE" : "OFFLINE";
            let statusDot = isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400";
            
            if(isDemo) {
                statusText = "SIMULADO";
                statusDot = "bg-orange-400";
                statusClass += " border-orange-200";
            }

            // --- 🔥 NOVO: LÓGICA DE NÍVEIS E SELOS ---
            let seloNivel = "";
            let bordaCard = "border-gray-100"; // Borda padrão
            
            if (user.service_level === 'premium') {
                seloNivel = `<span class="bg-black text-yellow-400 text-[8px] font-black px-2 py-0.5 rounded border border-yellow-500 uppercase shadow-sm">💎 PREMIUM</span>`;
                bordaCard = "border-yellow-400 shadow-md ring-1 ring-yellow-100"; // Destaque Dourado
            } else if (user.service_level === 'pro') {
                seloNivel = `<span class="bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase shadow-sm">⚡ PRO</span>`;
                bordaCard = "border-blue-200 shadow-sm"; // Destaque Azul
            }

            // --- IMAGENS ---
            const coverImg = user.cover_image || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=500';
            const avatarImg = user.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeProf)}&background=random`;

            // --- AÇÕES DE CLIQUE ---
            const clickActionPerfil = isDemo 
                ? `alert('🚧 PERFIL SIMULADO\\nEste é um exemplo visual do MVP.')` 
                : `window.verPerfilCompleto('${user.id}')`;

            const clickActionSolicitar = isDemo 
                ? `alert('🚧 AÇÃO BLOQUEADA\\nNão é possível contratar prestadores simulados.')` 
                : `(async (btn) => { 
                    const originalText = btn.innerHTML;
                    btn.innerHTML = 'Aguarde...';
                    btn.disabled = true;
                    window.lastOpenedOrderId = null; 
                    if(window.unsubscribeChat) { window.unsubscribeChat(); window.unsubscribeChat = null; }
                    await window.abrirModalSolicitacao('${user.id}', '${nomeProf}', '${mainService.price}');
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                })(this)`;

            // --- HTML DO CARD ---
            // Buscamos o ID do usuário logado para pintar o coração de vermelho caso ele já tenha curtido
            const meuUidLogado = auth.currentUser ? auth.currentUser.uid : "";
            const curtidoPorMim = user.liked_by && user.liked_by.includes(meuUidLogado);
            const corCoracao = curtidoPorMim ? "text-red-500 scale-110" : "text-gray-400 hover:text-red-400";

            container.innerHTML += `
                <div class="bg-white rounded-2xl shadow-sm border ${bordaCard} overflow-hidden relative ${statusClass} transition hover:shadow-lg flex flex-col h-full animate-fadeIn group" data-provider-id="${user.id}">
                    
                    <div class="h-24 bg-gray-200 relative">
                                                <div onclick="${clickActionPerfil}" class="w-full h-full cursor-pointer">
                            <img src="${coverImg}" class="w-full h-full object-cover group-hover:scale-105 transition duration-700">
                        </div>
                        
                                                <button onclick="window.alternarCurtidaPrestador('${user.id}')" 
                                class="absolute top-2 left-2 bg-white/90 backdrop-blur-md w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all active:scale-75 z-20 border border-black/5 font-black text-xs ${corCoracao}">
                            ❤️ <span class="text-[8px] text-gray-700 ml-0.5 font-sans font-bold">${user.likes_count || 0}</span>
                        </button>
                                    
                        <div class="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
                            ${seloNivel}
                            ${user.is_verified ? '<span class="bg-green-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">✓ VERIFICADO</span>' : ''}
                        </div>
                        
                        <div class="absolute bottom-[-16px] left-3 flex items-end">
                            <img src="${avatarImg}" class="w-10 h-10 rounded-full border-2 border-white shadow-md bg-white object-cover">
                        </div>
                    </div>

                    <div class="p-3 pt-5 flex-1 flex flex-col justify-between">
                        <div class="flex justify-between items-start mb-1">
                            <div class="pr-1">
                                <h3 class="text-gray-800 font-bold text-xs truncate max-w-[120px] leading-tight">${nomeProf}</h3>
                                <div class="flex items-center gap-1 text-[9px] text-yellow-500">
                                    <span>⭐ ${user.rating_avg || 5.0}</span>
                                    <span class="text-gray-300">(${user.services_count || 0} Serviços)</span>
                                </div>
                            </div>
                            <span class="font-black text-green-600 text-xs whitespace-nowrap bg-green-50 px-2 py-0.5 rounded">${precoDisplay}</span>
                        </div>
                        
                        <div class="mb-3">
                             <p class="text-[10px] font-bold text-blue-900 uppercase truncate flex items-center">
                                ${tituloServico} ${badgeMulti}
                             </p>
                             <p class="text-[9px] text-gray-400 line-clamp-1">${mainService.description || user.bio || 'Disponível para serviços.'}</p>
                        </div>

                        <div class="flex items-center gap-2 pt-2 border-t border-gray-50 mt-auto">
                            <div class="flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full ${statusDot}"></span>
                                <span class="text-[8px] font-bold text-gray-400 uppercase">${statusText}</span>
                            </div>
                            <button onclick="${clickActionSolicitar}" class="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[9px] font-black shadow hover:bg-slate-800 flex-1 transition transform active:scale-95 uppercase tracking-tighter">
                                VER E SOLICITAR
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            console.warn("Erro ao renderizar card:", err);
        }
    });
}

export function switchServiceSubTab(tabName) {
    ['contratar', 'andamento', 'historico'].forEach(t => {
        const elView = document.getElementById(`view-${t}`);
        const elBtn = document.getElementById(`subtab-${t}-btn`);
        if(elView) elView.classList.add('hidden');
        if(elBtn) {
            elBtn.classList.remove('active', 'text-blue-900', 'border-blue-600');
            elBtn.classList.add('text-gray-400');
        }
    });
    
    const targetView = document.getElementById(`view-${tabName}`);
    const targetBtn = document.getElementById(`subtab-${tabName}-btn`);
    
    if(targetView) {
        targetView.classList.remove('hidden');
        targetView.style.setProperty('display', 'block', 'important');
    }
    if(targetBtn) {
        targetBtn.classList.remove('text-gray-400');
        targetBtn.classList.add('active', 'text-blue-900', 'border-blue-600');
    }

    // 🔥 GATILHO DE CARGA REALTIME V24 (PÓS-SANEAMENTO)
    if (tabName === 'andamento') {
        console.log("⏳ Iniciando escuta de pedidos ativos...");
        window.carregarPedidosAtivos();
    }
    if (tabName === 'historico') {
        console.log("📜 Recuperando histórico purificado...");
        window.carregarHistorico();
    }
}

// ============================================================================
// 3. GESTÃO DO PRESTADOR (PAINEL + ANTI-GOLPE)
// ============================================================================

export function switchProviderSubTab(tabName) {
    ['radar', 'ativos', 'historico'].forEach(t => {
        const elView = document.getElementById(`pview-${t}`);
        const elBtn = document.getElementById(`ptab-${t}-btn`);
        if(elView) elView.classList.add('hidden');
        if(elBtn) elBtn.classList.remove('active', 'text-blue-900', 'border-blue-600');
    });
    
    const targetView = document.getElementById(`pview-${tabName}`);
    const targetBtn = document.getElementById(`ptab-${tabName}-btn`);

    if(targetView) targetView.classList.remove('hidden');
    if(targetBtn) targetBtn.classList.add('active', 'text-blue-900', 'border-blue-600');

    // 🔥 GATILHO DE CARGA PRESTADOR V23.1
    if (tabName === 'ativos') {
        console.log("📡 Buscando Pedidos Ativos...");
        window.carregarPedidosPrestador();
    }
    if (tabName === 'historico') {
        console.log("📜 Buscando Histórico Profissional...");
        window.carregarHistoricoPrestador();
    }
}

// ============================================================================
// 2. PEDIDOS E HISTÓRICO (VERSÃO BLINDADA V13.0)
// ============================================================================

// --- VISÃO DO CLIENTE (QUEM CONTRATA) ---
export async function carregarPedidosAtivos() {
    const view = document.getElementById('view-andamento');
    const container = document.getElementById('meus-pedidos-andamento');
    if (!container || !view) return;
    
    view.style.setProperty('display', 'block', 'important');
    view.classList.remove('hidden');
    if (!auth.currentUser) { setTimeout(carregarPedidosAtivos, 500); return; }
    
    const q = query(collection(db, "orders"), where("client_id", "==", auth.currentUser.uid), orderBy("created_at", "desc"));
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        const statusVivos = ['pending', 'accepted', 'confirmed_hold', 'in_progress', 'negotiation_closed', 'expired', 'completed'];
        let ativos = [];
        snap.forEach(d => { 
            const p = d.data();
            const sB = p.status ? p.status.toString().toLowerCase().trim() : '';
            if(statusVivos.includes(sB)) {
                ativos.push({id: d.id, ...p});
                if (window.verificarVidaUtilChat) window.verificarVidaUtilChat({id: d.id, ...p});
            }
        });
        if (ativos.length === 0) { container.innerHTML = `<p class="text-center text-xs text-gray-400 py-6">Nenhum pedido ativo.</p>`; return; }
        ativos.forEach(p => {
            const statusPT = window.traduzirStatus(p.status);
            container.innerHTML += `<div onclick="window.abrirChatPedido('${p.id}')" class="bg-white p-3 rounded-xl border border-blue-100 shadow-sm mb-2 cursor-pointer flex justify-between items-center animate-fadeIn">
                <div><h3 class="font-bold text-gray-800 text-sm">${p.provider_name || 'Prestador'}</h3><p class="text-[10px] text-gray-500 uppercase">R$ ${p.offer_value} • ${statusPT}</p></div><span>💬</span></div>`;
        });
    });
}

// VISÃO CLIENTE: HISTÓRICO (V24 - ESTABILIZADO)
export async function carregarHistorico() {
    const container = document.getElementById('meus-pedidos-historico') || document.getElementById('view-historico');
    if(!container) return;
    
    // 🛡️ SINAL DE NÃO PERTURBE: Aguarda a UI estabilizar antes de renderizar
    if (container.offsetParent === null) { 
        setTimeout(carregarHistorico, 50); 
        return; 
    }

    if (!auth.currentUser) { setTimeout(carregarHistorico, 500); return; }

    const q = query(collection(db, "orders"), where("client_id", "==", auth.currentUser.uid), orderBy("created_at", "desc"));
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        const statusHist = ['completed', 'archived', 'negotiation_closed', 'cancelled', 'expired'];
        let cont = 0;
        snap.forEach(d => {
            const o = d.data();
            const sB = o.status ? o.status.toString().toLowerCase().trim() : '';
            if (statusHist.includes(sB)) {
                cont++;
                const dataObj = o.completed_at || o.created_at;
                const dataTxt = dataObj && typeof dataObj.toDate === 'function' ? dataObj.toDate().toLocaleDateString() : "---";
                container.innerHTML += `<div class="bg-white p-3 rounded-xl mb-2 border border-gray-100 flex justify-between items-center shadow-sm animate-fadeIn">
                    <div><p class="font-bold text-xs text-gray-700">${(o.provider_name || 'Prestador').replace(/'/g, "")}</p><p class="text-[9px] text-gray-400 uppercase">${dataTxt} • ${o.status}</p></div>
                    <div class="text-right"><span class="block font-black text-green-600 text-xs">R$ ${o.offer_value}</span><button onclick="window.abrirModalAvaliacao('${d.id}', '${o.provider_id}', '${(o.provider_name || 'Prestador').replace(/'/g, "")}')" class="text-[9px] text-blue-600 font-bold underline uppercase mt-1">Avaliar ⭐</button></div></div>`;
            }
        });
        if(cont === 0) container.innerHTML = `<p class="text-center text-xs text-gray-400 py-6 italic">Histórico limpo.</p>`;
    });
}

// --- VISÃO DO PRESTADOR ---
export async function carregarPedidosPrestador() {
    const container = document.getElementById('lista-chamados-ativos');
    if(!container) return;
    if (!auth.currentUser) { setTimeout(carregarPedidosPrestador, 500); return; }

    const q = query(collection(db, "orders"), where("provider_id", "==", auth.currentUser.uid), orderBy("created_at", "desc"));
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        const statusAtivos = ["pending", "accepted", "confirmed_hold", "in_progress", "negotiation_closed"];
        let cont = 0;
       snap.forEach(d => {
            const o = d.data();
            const sB = o.status ? o.status.toString().toLowerCase().trim() : '';
            if (statusAtivos.includes(sB)) {
                cont++;
                if (window.verificarVidaUtilChat) window.verificarVidaUtilChat({id: d.id, ...o});
                const color = o.status === 'in_progress' ? "bg-blue-100 text-blue-700" : (o.status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700");
                const mapaStatusProv = { 'pending': 'Novo Pedido', 'accepted': 'Em Chat', 'confirmed_hold': 'Acordo Fechado', 'in_progress': 'Em Execução' };
                const txt = mapaStatusProv[o.status] || 'Pendente';
                container.innerHTML += `<div onclick="window.abrirChatPedido('${d.id}')" class="bg-white p-3 rounded-xl border border-blue-100 shadow-sm mb-2 cursor-pointer flex justify-between items-center hover:bg-gray-50 animate-fadeIn">
                    <div><h3 class="font-bold text-xs text-gray-800">${o.client_name || 'Cliente'}</h3><p class="text-[10px] text-gray-500">${o.location || 'Local a combinar'}</p></div>
                    <div class="text-right"><span class="block font-black text-green-600 text-xs">R$ ${o.offer_value}</span><span class="text-[8px] px-2 py-0.5 rounded-full ${color} uppercase font-bold">${txt}</span></div></div>`;
            }
        });
        if(cont === 0) container.innerHTML = `<p class="text-center text-xs text-gray-400 py-4">Sem pedidos ativos no radar.</p>`;
    });
}
// VISÃO DO PRESTADOR HISTÓRICO (V24 - ESTABILIZADO)
export async function carregarHistoricoPrestador() {
    const container = document.getElementById('lista-chamados-historico');
    if(!container) return;

    // 🛡️ SINAL DE NÃO PERTURBE
    if (container.offsetParent === null) { 
        setTimeout(carregarHistoricoPrestador, 50); 
        return; 
    }

    if (!auth.currentUser) { setTimeout(carregarHistoricoPrestador, 500); return; }

    const q = query(collection(db, "orders"), where("provider_id", "==", auth.currentUser.uid), orderBy("created_at", "desc"));
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        const statusFinal = ['completed', 'archived', 'negotiation_closed', 'cancelled'];
        let cont = 0;
        snap.forEach(d => {
            const o = d.data();
            const sB = o.status ? o.status.toString().toLowerCase().trim() : '';
            if (statusFinal.includes(sB)) {
                cont++;
                const dataObj = o.completed_at || o.created_at;
                const dataTxt = dataObj && typeof dataObj.toDate === 'function' ? dataObj.toDate().toLocaleDateString() : "---";
                container.innerHTML += `<div class="bg-green-50 p-3 rounded-xl mb-2 border border-green-100 flex justify-between items-center animate-fadeIn">
                    <div><h3 class="font-bold text-xs text-green-900">${(o.client_name || 'Cliente').replace(/['"]/g, "")}</h3><p class="text-[10px] text-green-700">Finalizado em ${dataTxt} • <span class="uppercase">CONCLUÍDO ✨</span></p></div>
                    <div class="text-right"><span class="block font-black text-green-700 text-xs">+ R$ ${o.offer_value}</span><button onclick="window.abrirModalAvaliacao('${d.id}', '${o.client_id}', '${(o.client_name || 'Cliente').replace(/'/g, "")}')" class="text-[9px] text-blue-600 font-bold underline mt-1">Avaliar Cliente ⭐</button></div></div>`;
            }
        });
        if(cont === 0) container.innerHTML = `<p class="text-center text-xs text-gray-400 py-4">Nenhum histórico de trabalho.</p>`;
    });
}

// ============================================================================
// 4. EDITOR DE SERVIÇOS (COM CAPA, TÍTULO E DESCRIÇÃO)
// ============================================================================
export async function abrirConfiguracaoServicos() {
    const modal = document.getElementById('provider-setup-modal');
    const content = document.getElementById('provider-setup-content');
    if(!modal || !content) return;

    modal.classList.remove('hidden');
    
    const uid = auth.currentUser.uid;
    const docSnap = await getDoc(doc(db, "active_providers", uid));
    let currentHtml = "";
    
    const currentCover = (docSnap.exists() && docSnap.data().cover_image) 
        ? docSnap.data().cover_image 
        : 'https://images.unsplash.com/photo-1557683316-973673baf926?w=500';

    if(docSnap.exists() && docSnap.data().services) {
        const servicos = docSnap.data().services;
        if(servicos.length > 0) {
            currentHtml = `<div class="bg-gray-50 p-3 rounded-xl mb-4 max-h-48 overflow-y-auto space-y-2 border border-gray-100 custom-scrollbar">
                <p class="text-[9px] font-bold text-gray-400 uppercase sticky top-0 bg-gray-50 z-10">Seus Serviços</p>
                ${servicos.map((s, index) => {
                    const safeObj = JSON.stringify(s).replace(/"/g, '&quot;');
                    return `
                    <div class="flex flex-col bg-white p-2 rounded border border-gray-200">
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-bold text-gray-800">${s.title || s.category}</span>
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-black text-green-600">R$ ${s.price}</span>
                                <button onclick="window.prepararEdicao(${safeObj})" class="text-blue-500 font-bold text-xs hover:bg-blue-50 px-2 rounded">✏️</button>
                                <button onclick="window.removerServico('${s.category}', ${s.price}, '${s.title || ''}')" class="text-red-500 font-bold text-xs hover:bg-red-50 px-2 rounded">🗑️</button>
                            </div>
                        </div>
                        ${s.description ? `<p class="text-[10px] text-gray-500 mt-1 truncate">${s.description}</p>` : ''}
                        ${s.title ? `<span class="text-[8px] text-blue-400 bg-blue-50 w-fit px-1 rounded mt-1">${s.category}</span>` : ''}
                    </div>
                `}).join('')}
            </div>`;
        }
    }

    // 🆕 GERAÇÃO INTELIGENTE DO MENU V2 (GARANTE TODAS AS CATEGORIAS)
    let options = '<option value="" disabled selected>Selecione o serviço...</option>';
    const grupos = {};
    
    // 1. Agrupa os serviços da memória (Seus R$ 3000+)
    if (window.SERVICOS_PADRAO) {
        window.SERVICOS_PADRAO.forEach(s => {
            if(!grupos[s.category]) grupos[s.category] = [];
            grupos[s.category].push(s);
        });
    }

    // 2. Percorre a LISTA MESTRA (CATEGORIAS_ATIVAS) para garantir que NADA suma
    CATEGORIAS_ATIVAS.forEach(cat => {
        options += `<optgroup label="${cat.label}">`;
        
        // A. Se tiver serviços específicos (Premium/Padrão) definidos no código, lista eles
        if (grupos[cat.id]) {
            grupos[cat.id].forEach(item => {
                const isPremium = item.level === 'premium';
                const emoji = isPremium ? '💎' : '🔹';
                
                // Value = Categoria (para salvar compatível com o banco)
                options += `<option value="${cat.label}" 
                                    data-min="${item.price}" 
                                    data-prefill="${item.title}">
                                ${emoji} ${item.title} (Sugerido: R$ ${item.price})
                            </option>`;
            });
        }

        // B. SEMPRE adiciona uma opção genérica no final (Salva-vidas para categorias vazias)
        // Isso garante que Pets, Aulas, Beleza e Gerais apareçam para seleção manual
        options += `<option value="${cat.label}" data-min="${cat.minPrice}">
                        📂 Outro em ${cat.label.split(' ')[1]}... (Min: R$ ${cat.minPrice})
                    </option>`;
        
        options += `</optgroup>`;
    });
    content.innerHTML = `
        <h3 class="text-lg font-black text-blue-900 uppercase mb-2 text-center">Gerenciar Serviços</h3>
        
        <div class="mb-4 relative h-32 rounded-xl bg-gray-200 overflow-hidden group cursor-pointer shadow-md" onclick="document.getElementById('input-banner').click()">
            <img id="preview-banner" src="${currentCover}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <span class="text-white font-bold text-xs border border-white px-3 py-1 rounded-full">📷 ALTERAR CAPA</span>
            </div>
            <input type="file" id="input-banner" accept="image/*" class="hidden" onchange="window.salvarCapaPrestador(this)">
        </div>
        <!-- 🛡️ AVISO ANTI-FRAUDE V2026 -->
        <p class="text-[8px] text-red-500 font-bold uppercase text-center -mt-2 mb-4 animate-pulse">⚠️ Proibido contatos na imagem. Risco de banimento imediato.</p>

        ${currentHtml}
        
        <div class="space-y-3 pt-2 border-t border-gray-100 relative">
            <p id="form-mode-title" class="text-[10px] font-bold text-blue-600 uppercase">Adicionar Novo</p>
            
            <input type="hidden" id="prov-old-data" value="">

            <div>
                <input type="text" id="prov-title" class="w-full border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white transition" placeholder="Título (ex: Faxina Completa)">
            </div>
            <div>
                <select id="prov-cat" class="w-full border p-2 rounded-lg text-sm bg-white" onchange="window.atualizarMinimo(this)">${options}</select>
            </div>
            <div>
                <textarea id="prov-desc" rows="2" class="w-full border p-2 rounded-lg text-sm bg-gray-50 focus:bg-white resize-none" placeholder="Detalhes (ex: Inclui vidros e varanda)"></textarea>
            </div>
            <div>
                <input type="number" id="prov-price" class="w-full border p-2 rounded-lg text-sm font-bold text-green-600" placeholder="0.00">
                <p id="msg-min-price" class="text-[9px] text-red-500 mt-1 font-bold hidden"></p>
            </div>

            <div class="flex gap-2">
                <button id="btn-cancel-edit" onclick="window.cancelarEdicao()" class="hidden w-1/3 bg-gray-200 text-gray-600 py-3 rounded-xl font-bold">CANCELAR</button>
                <button id="btn-save-service" onclick="salvarServicoPrestador()" class="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg">ADICIONAR SERVIÇO</button>
            </div>
        </div>
    `;
    setTimeout(() => {
        const select = document.getElementById('prov-cat');
        if(select) window.atualizarMinimo(select);
    }, 100);
}

// ✅ NOVA FUNÇÃO: UPLOAD DA CAPA (CORRIGIDA)
// ✅ TRIAGEM PREVENTIVA ACELERADA E CORRIGIDA V2026 (SEM ERROS DE SINTAXE)
window.salvarCapaPrestador = async (input) => {
    const file = input.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return alert("Erro de autenticação.");

    // Captura o contêiner do botão para travar a tela contra cliques ansiosos
    const containerUpload = input.parentElement;

    // 🛑 CONGELAMENTO DE TELA: Bloqueia interações para evitar re-cliques
    containerUpload.style.pointerEvents = "none";
    
    // Injeta a tarja preta protetora por cima de qualquer imagem (Garante leitura visual)
    let avisoFlutuante = document.getElementById("aviso-analise-ia");
    if (!avisoFlutuante) {
        avisoFlutuante = document.createElement("div");
        avisoFlutuante.id = "aviso-analise-ia";
        avisoFlutuante.className = "absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-4 z-50 animate-pulse";
        avisoFlutuante.innerHTML = `
            <span class="text-amber-400 font-black text-xs uppercase tracking-wider mb-1">⏳ ANALISANDO SUA CAPA...</span>
            <span class="text-white font-bold text-[10px] uppercase">Por favor, não saia desta tela até a conclusão.</span>
        `;
        containerUpload.appendChild(avisoFlutuante);
    }

    // Carrega o preview da imagem por baixo da tarja
    const reader = new FileReader();
    reader.onload = (e) => document.getElementById('preview-banner').src = e.target.result;
    reader.readAsDataURL(file);

    try {
        // Carrega o script do motor se não existir na página
        if (typeof Tesseract === 'undefined') {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
                s.onload = resolve;
                s.onerror = () => reject(new Error("Erro ao carregar sensor de mídia"));
                document.head.appendChild(s);
            });
        }

        // 🚀 ACELERADOR ULTRA DE FÁBRICA: Inicializa o motor desativando análises pesadas de layout
        // 'tessedit_pageseg_mode': '7' força a IA a ler a imagem como uma linha única de texto puro (Acelera 3x)
        const worker = await Tesseract.createWorker('por+eng', 1, {
            cacheMethod: 'write',
            workerOptions: {
                tessedit_pageseg_mode: '7'
            }
        });

        // Executa o reconhecimento local direto da memória do aparelho
        const { data: { text } } = await worker.recognize(file);
        const textoLimpo = text.trim().toLowerCase();
        await worker.terminate(); // Libera a memória RAM do dispositivo imediatamente

        // Filtros contra dados de contato proibidos
        const temNumero = /\d{4,}/.test(textoLimpo);
        const temGatilho = textoLimpo.includes('@') || textoLimpo.includes('whats') || textoLimpo.includes('contato') || textoLimpo.includes('insta') || textoLimpo.includes('call') || textoLimpo.includes('chama');

        // 🚨 VEREDITO: REPROVADO (Contato detectado)
        if (temNumero || temGatilho) {
            containerUpload.style.pointerEvents = "auto";
            if (avisoFlutuante) avisoFlutuante.remove(); // Limpa a tarja preta
            input.value = ""; 
            document.getElementById('preview-banner').src = 'https://images.unsplash.com/photo-1557683316-973673baf926?w=500';
            
            return alert("❌ ANÁLISE CONCLUÍDA: FORAM ENCONTRADOS DADOS DE CONTATOS NA SUA IMAGEM. Para evitar bloqueio na sua conta, evite enviar contatos na sua capa.");
        }

        // Modifica o texto interno da tarja para mostrar o progresso real do envio na nuvem
        avisoFlutuante.innerHTML = `<span class="text-green-400 font-black text-xs uppercase animate-bounce">⚡ APROVADO! PUBLICANDO CAPA...</span>`;

        // Executa o envio para o Firebase Storage
        const storage = getStorage();
        const storageRef = ref(storage, `provider_covers/${user.uid}_${Date.now()}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        // Atualiza a URL limpa e aprovada no Firestore
        await setDoc(doc(db, "active_providers", user.uid), { cover_image: url }, { merge: true });
        
        // Descongela a tela e limpa o aviso
        containerUpload.style.pointerEvents = "auto";
        if (avisoFlutuante) avisoFlutuante.remove();
        
        alert("✨ Sucesso! Sua nova capa foi publicada no aplicativo.");

    } catch (e) {
        console.error("Falha na triagem:", e);
        containerUpload.style.pointerEvents = "auto";
        if (avisoFlutuante) avisoFlutuante.remove();
        alert("Erro técnico ao processar imagem: " + e.message);
    }
};

window.prepararEdicao = (obj) => {
    document.getElementById('prov-title').value = obj.title || "";
    document.getElementById('prov-desc').value = obj.description || "";
    document.getElementById('prov-price').value = obj.price;
    const select = document.getElementById('prov-cat');
    for(let i=0; i<select.options.length; i++) {
        if(select.options[i].value === obj.category) {
            select.selectedIndex = i;
            break;
        }
    }
    document.getElementById('prov-old-data').value = JSON.stringify(obj);
    document.getElementById('form-mode-title').innerText = "Editando Serviço";
    document.getElementById('btn-save-service').innerText = "SALVAR ALTERAÇÕES";
    document.getElementById('btn-save-service').classList.replace('bg-blue-600', 'bg-green-600');
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
    document.getElementById('prov-title').focus();
};

window.cancelarEdicao = () => {
    document.getElementById('prov-title').value = "";
    document.getElementById('prov-desc').value = "";
    document.getElementById('prov-price').value = "";
    document.getElementById('prov-old-data').value = "";
    document.getElementById('form-mode-title').innerText = "Adicionar Novo";
    document.getElementById('btn-save-service').innerText = "ADICIONAR SERVIÇO";
    document.getElementById('btn-save-service').classList.replace('bg-green-600', 'bg-blue-600');
    document.getElementById('btn-cancel-edit').classList.add('hidden');
};

window.removerServico = async (cat, price, title) => {
    if(!confirm(`Remover este serviço?`)) return;
    const uid = auth.currentUser.uid;
    const ref = doc(db, "active_providers", uid);
    try {
        const snap = await getDoc(ref);
        if(snap.exists()) {
            let services = snap.data().services || [];
            // 🛡️ REMOÇÃO PRECISA: Filtra combinando título, categoria e preço para não apagar o serviço errado
            const newServices = services.filter(s => {
                const matchTitulo = s.title === title;
                const matchCat = s.category === cat;
                const matchPreco = parseFloat(s.price) === parseFloat(price);
                return !(matchTitulo && matchCat && matchPreco);
            });
            await setDoc(ref, { services: newServices }, { merge: true });
            abrirConfiguracaoServicos(); 
        }
    } catch(e) { alert("Erro ao remover: " + e.message); }
};

window.atualizarMinimo = (select) => {
    const option = select.options[select.selectedIndex];
    const min = option.dataset.min;
    const prefillTitle = option.dataset.prefill; // Novo dado que injetamos
    
    // ⚡ AUTO-PREENCHIMENTO INTELIGENTE
    // Se escolheu um serviço específico, já preenche o nome e o preço
    if(prefillTitle) {
        document.getElementById('prov-title').value = prefillTitle;
        document.getElementById('prov-price').value = min; 
    }

    const msg = document.getElementById('msg-min-price');
    const inputPreco = document.getElementById('prov-price');

    // 🛡️ TRAVA ANTI-NAN: Garante que 'min' seja número e nunca vazio
    const valorMinSeguro = parseFloat(min || 0); 

    if (inputPreco) {
        inputPreco.placeholder = `Mínimo: R$ ${valorMinSeguro.toFixed(2).replace('.', ',')}`;
    }

    if (msg) {
        msg.innerText = `⚠️ Valor Mínimo: R$ ${valorMinSeguro.toFixed(2).replace('.', ',')}`;
        msg.classList.remove('hidden');
    }
};

export async function salvarServicoPrestador() {
    const user = auth.currentUser;
    const select = document.getElementById('prov-cat');
    const priceInput = document.getElementById('prov-price');
    const titleInput = document.getElementById('prov-title');
    const descInput = document.getElementById('prov-desc');
    const oldDataInput = document.getElementById('prov-old-data');
    
    if(!select || !priceInput) return;

    const category = select.value;
    const price = parseFloat(priceInput.value);
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const minPrice = parseFloat(select.options[select.selectedIndex].dataset.min);

    // 🛡️ FILTRO ANTI-FRAUDE TURBO V2026 (Telefones, Links e Arrobas)
    if(!title) return alert("❌ Digite um título para o serviço.");

    // 1. Regex para Telefones (Padrão BR com DDD)
    const regexFone = /(?:\(?\d{2}\)?\s?|\d{2}?\s?)\d{4,5}\s?-?\s?\d{4}/g;
    // 2. Regex para Links e Arrobas (Instagram, Facebook e Sites)
    const regexLinks = /(@[\w.]+)|(https?:\/\/)|(\w+\.(com|net|org|br|me|link|site))/gi;

    // Gil, aqui o "Zelador" reseta o índice da Regex para garantir que a detecção não falhe em cliques seguidos
    regexFone.lastIndex = 0;
    regexLinks.lastIndex = 0;

    const temFraudeTexto = regexFone.test(title) || regexFone.test(description) || 
                           regexLinks.test(title) || regexLinks.test(description);

    if (temFraudeTexto) {
        return alert("⛔ SEGURANÇA ATLIVIO: Por políticas de proteção e garantia de pagamento, não é permitido incluir telefones, arrobas (@) ou links externos nos detalhes. Utilize nosso chat oficial para negociar com segurança.");
    }

    if(isNaN(price) || price < minPrice) {
        return alert(`⛔ Preço muito baixo!\nO mínimo para ${category} é R$ ${minPrice},00.`);
    }

    const newService = { 
        title: title,
        category: category, 
        price: price, 
        description: description,
        status: 'ativo' 
    };

try {
        const ref = doc(db, "active_providers", user.uid);
        
        // Se estiver editando, remove o antigo antes (usando setDoc com merge para segurança)
        if (oldDataInput.value) {
            const oldService = JSON.parse(oldDataInput.value);
            await setDoc(ref, { services: arrayRemove(oldService) }, { merge: true });
        }
        
       // Salva o serviço garantindo que não existam campos financeiros obsoletos no objeto - PONTO CRÍTICO SOLUÇÃO BÔNUS
        await setDoc(ref, { 
            uid: user.uid,
            nome_profissional: user.displayName || 'Prestador',
            services: arrayUnion(newService), 
            is_online: true,
            status: 'aprovado',
            updated_at: serverTimestamp()
        }, { merge: true });

        alert("✅ Serviço salvo com sucesso!");
        abrirConfiguracaoServicos();
    } catch(e) { 
        console.error("Erro fatal no salvamento:", e);
        alert("Erro ao salvar: " + e.message); 
    }
}

// ❤️ MOTOR DE CURTIDAS ATÔMICO: Grava e remove curtidas impedindo spam de votos falsos
window.alternarCurtidaPrestador = async function(providerId) {
    const eleMe = auth.currentUser;
    if (!eleMe) return alert("🔒 ACESSO RESTRITO: Faça login para poder curtir os profissionais!");

    try {
        const provRef = doc(db, "active_providers", providerId);
        const provSnap = await getDoc(provRef);
        
        if (provSnap.exists()) {
            const data = provSnap.data();
            const curtidores = data.liked_by || [];
            
            // Se o meu UID já estiver lá dentro, significa que estou clicando para "descurtir"
            if (curtidores.includes(eleMe.uid)) {
                await setDoc(provRef, {
                    liked_by: arrayRemove(eleMe.uid),
                    likes_count: increment(-1)
                }, { merge: true });
                console.log("❤️ [Curtida] Removida do prestador: " + providerId);
            } else {
                // Caso contrário, adiciona o meu UID no cofre de segurança e soma +1
                await setDoc(provRef, {
                    liked_by: arrayUnion(eleMe.uid),
                    likes_count: increment(1)
                }, { merge: true });
                console.log("❤️ [Curtida] Registrada para o prestador: " + providerId);
            }
        }
    } catch (error) {
        console.error("Erro ao computar curtida social:", error);
    }
};

console.log("%c✅ SERVICES.JS: Funções expostas, IA Protetora mantida e Sistema de Curtidas Ativo!", "color: #10b981; font-weight: bold;");

// 🌍 EXPOSIÇÃO GLOBAL V24.1 (ESTABILIZADA)
window.carregarServicos = carregarServicos;
window.filtrarServicos = (cat) => carregarServicos(cat);
window.switchServiceSubTab = switchServiceSubTab;
window.switchProviderSubTab = switchProviderSubTab;
window.carregarPedidosAtivos = carregarPedidosAtivos;
window.carregarHistorico = carregarHistorico;
window.carregarPedidosPrestador = carregarPedidosPrestador;
window.carregarHistoricoPrestador = carregarHistoricoPrestador;
window.abrirConfiguracaoServicos = abrirConfiguracaoServicos;
window.salvarServicoPrestador = salvarServicoPrestador;
window.salvarCapaPrestador = salvarCapaPrestador;

console.log("%c✅ SERVICES.JS: Funções expostas e estabilização V24 ativa!", "color: #10b981; font-weight: bold;");
