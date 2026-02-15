import { db, auth } from '../config.js';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, updateDoc, arrayUnion, arrayRemove, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
            const temServicos = user.services && Array.isArray(user.services) && user.services.length > 0;
            const mainService = temServicos ? user.services[0] : { category: 'Geral', price: 'A Combinar', title: 'Serviço' };
            
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
                : `window.abrirModalSolicitacao('${user.id}', '${nomeProf}', '${mainService.price}')`;

            // --- HTML DO CARD ---
            container.innerHTML += `
                <div class="bg-white rounded-2xl shadow-sm border ${bordaCard} overflow-hidden relative ${statusClass} transition hover:shadow-lg flex flex-col h-full animate-fadeIn group">
                    
                    <div onclick="${clickActionPerfil}" class="h-24 bg-gray-200 relative cursor-pointer">
                        <img src="${coverImg}" class="w-full h-full object-cover group-hover:scale-105 transition duration-700">
                        
                        <div class="absolute top-2 right-2 flex flex-col items-end gap-1">
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
                             <p class="text-[10px] font-bold text-blue-900 uppercase truncate">${tituloServico}</p>
                             <p class="text-[9px] text-gray-400 line-clamp-1">${mainService.description || user.bio || 'Disponível para serviços.'}</p>
                        </div>

                        <div class="flex items-center gap-2 pt-2 border-t border-gray-50 mt-auto">
                            <div class="flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full ${statusDot}"></span>
                                <span class="text-[8px] font-bold text-gray-400 uppercase">${statusText}</span>
                            </div>
                            <button onclick="${clickActionSolicitar}" class="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow hover:bg-slate-800 flex-1 transition transform active:scale-95">
                                SOLICITAR
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

// ============================================================================
// 2. PEDIDOS E HISTÓRICO
// ============================================================================
export async function carregarPedidosAtivos() {
    const container = document.getElementById('meus-pedidos-andamento') || document.getElementById('view-andamento');
    if (!container || !auth.currentUser) return;
    container.innerHTML = `<div class="loader mx-auto border-blue-500 mt-2"></div>`;
    
    const uid = auth.currentUser.uid;
    const q = query(collection(db, "orders"), where("client_id", "==", uid), orderBy("created_at", "desc"));
    
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        let pedidos = [];
        snap.forEach(d => {
            const p = d.data();
            // 🛡️ CORREÇÃO: Filtro rigoroso para remover Cancelados e Encerrados da vista
            const statusLixo = ['completed', 'rejected', 'cancelled', 'negotiation_closed'];
            if(!statusLixo.includes(p.status)) pedidos.push({id: d.id, ...p});
        });

        if (pedidos.length === 0) { container.innerHTML = `<p class="text-center text-xs text-gray-400 py-6">Nenhum pedido ativo.</p>`; return; }

        pedidos.forEach(p => {
            container.innerHTML += `
                <div onclick="window.abrirChatPedido('${p.id}')" class="bg-white p-3 rounded-xl border border-blue-100 shadow-sm mb-2 cursor-pointer flex justify-between items-center animate-fadeIn">
                    <div>
                        <h3 class="font-bold text-gray-800 text-sm">${p.provider_name}</h3>
                        <p class="text-[10px] text-gray-500">R$ ${p.offer_value} • ${p.status}</p>
                    </div>
                    <span>💬</span>
                </div>
            `;
        });
    });
}

export async function carregarHistorico() {
    const container = document.getElementById('meus-pedidos-historico') || document.getElementById('view-historico');
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
    
    if(targetView) targetView.classList.remove('hidden');
    if(targetBtn) {
        targetBtn.classList.remove('text-gray-400');
        targetBtn.classList.add('active', 'text-blue-900', 'border-blue-600');
    }

    if(tabName === 'andamento') carregarPedidosAtivos();
    if(tabName === 'historico') carregarHistorico();
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

    if(tabName === 'ativos') carregarPedidosPrestador();
    if(tabName === 'historico') carregarHistoricoPrestador();
}

async function carregarPedidosPrestador() {
    const container = document.getElementById('lista-chamados-ativos');
    if(!container) return;
    container.innerHTML = `<div class="loader mx-auto border-blue-500"></div>`;

   const q = query(collection(db, "orders"), 
        where("provider_id", "==", uid), 
        where("status", "in", ["pending", "accepted", "confirmed_hold", "in_progress"]), 
        orderBy("created_at", "desc")
    );

    const snap = await getDocs(q);
    container.innerHTML = "";

    if(snap.empty) { container.innerHTML = `<p class="text-center text-xs text-gray-400 py-4">Sem pedidos ativos.</p>`; return; }

    snap.forEach(d => {
        const order = d.data();
        
        // 🛡️ CORREÇÃO: Filtro de Segurança Manual (Garante que Encerrados sumam imediatamente)
        const statusLixo = ['negotiation_closed', 'cancelled', 'rejected', 'completed'];
        if (statusLixo.includes(order.status)) return; // Pula este item se for lixo

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
// ✅ SUBSTITUA APENAS ESTA FUNÇÃO NO FINAL DO ARQUIVO
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
            // Tratamento de segurança para nomes com aspas
            const safeName = (order.client_name || 'Cliente').replace(/'/g, "");
            
            container.innerHTML += `
                <div class="bg-green-50 p-3 rounded-xl mb-2 border border-green-100 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-xs text-green-900">${safeName}</h3>
                        <p class="text-[10px] text-green-700">Concluído em ${order.completed_at?.toDate().toLocaleDateString()}</p>
                    </div>
                    <div class="text-right">
                        <span class="block font-black text-green-700 text-xs">+ R$ ${order.offer_value}</span>
                        <button onclick="window.abrirModalAvaliacao('${d.id}', '${order.client_id}', '${safeName}')" class="text-[9px] text-blue-600 font-bold underline cursor-pointer mt-1 hover:text-blue-800">
                            Avaliar Cliente ⭐
                        </button>
                    </div>
                </div>
            `;
        });
    } catch(e) { console.error(e); }
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
window.salvarCapaPrestador = async (input) => {
    const file = input.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return alert("Erro de autenticação.");

    // Preview Imediato
    const reader = new FileReader();
    reader.onload = (e) => document.getElementById('preview-banner').src = e.target.result;
    reader.readAsDataURL(file);

    try {
        // 🔥 INICIALIZAÇÃO TARDIA DO STORAGE (SEGURANÇA)
        const storage = getStorage(); // Agora chama apenas no clique
        
        // Upload
        const storageRef = ref(storage, `provider_covers/${user.uid}_${Date.now()}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        // Atualiza
        await setDoc(doc(db, "active_providers", user.uid), { cover_image: url }, { merge: true });
        alert("✅ Capa atualizada com sucesso!");
    } catch (e) {
        console.error(e);
        alert("Erro ao enviar imagem. Tente novamente.");
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
            const newServices = services.filter(s => {
                if (title && s.title) return s.title !== title;
                return !(s.category === cat && parseFloat(s.price) === parseFloat(price));
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
    document.getElementById('prov-price').placeholder = `Mínimo: R$ ${min}`;
    msg.innerText = `⚠️ Valor Base: R$ ${min},00`;
    msg.classList.remove('hidden');
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

    if(!title) return alert("❌ Digite um título para o serviço.");
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

// EXPORTAÇÕES GLOBAIS
window.carregarServicos = carregarServicos;
window.filtrarServicos = (cat) => carregarServicos(cat);
window.switchServiceSubTab = switchServiceSubTab;
window.carregarPedidosAtivos = carregarPedidosAtivos;
window.carregarHistorico = carregarHistorico;
window.switchProviderSubTab = switchProviderSubTab;
window.abrirConfiguracaoServicos = abrirConfiguracaoServicos;
window.salvarServicoPrestador = salvarServicoPrestador;
window.iniciarMonitoramentoPedidos = carregarPedidosPrestador;
window.salvarCapaPrestador = window.salvarCapaPrestador;
