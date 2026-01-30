import { db, auth } from '../app.js';
import { collection, query, orderBy, limit, onSnapshot, where, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let cachePrestadores = [];
let unsubscribeVitrine = null;
let unsubscribePedidosAtivos = null;
let unsubscribeMeusServicos = null;

// --- GATILHOS ---
const tabServicos = document.getElementById('tab-servicos');
if (tabServicos) {
    tabServicos.addEventListener('click', () => {
        carregarServicosDisponiveis();
        iniciarMonitoramentoPedidos();
    });
}

// GATILHO EXTRA: Chama também quando troca de sub-aba
window.switchServiceSubTab = function(subTab) {
    ['contratar', 'andamento', 'historico'].forEach(t => {
        document.getElementById(`view-${t}`).classList.add('hidden');
        document.getElementById(`subtab-${t}-btn`).classList.remove('active');
    });
    document.getElementById(`view-${subTab}`).classList.remove('hidden');
    document.getElementById(`subtab-${subTab}-btn`).classList.add('active');
    
    if(subTab === 'andamento') iniciarMonitoramentoPedidos();
};

window.switchProviderSubTab = function(subTab) {
    ['radar', 'ativos', 'historico'].forEach(t => {
        document.getElementById(`pview-${t}`).classList.add('hidden');
        document.getElementById(`ptab-${t}-btn`).classList.remove('active');
    });
    document.getElementById(`pview-${subTab}`).classList.remove('hidden');
    document.getElementById(`ptab-${subTab}-btn`).classList.add('active');

    if(subTab === 'ativos') iniciarMonitoramentoPedidos();
};

// Expõe globalmente
window.carregarServicos = carregarServicosDisponiveis;
window.abrirModalContratacao = abrirModalContratacao;
window.filtrarCategoria = filtrarCategoria;
window.filtrarPorTexto = filtrarPorTexto;
window.fecharPerfilPublico = () => document.getElementById('provider-profile-modal')?.classList.add('hidden');
window.iniciarMonitoramentoPedidos = iniciarMonitoramentoPedidos;

function normalizarTexto(texto) {
    if (!texto) return "";
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ============================================================================
// 0. MONITORAMENTO DE PEDIDOS (ATIVOS E EM ANDAMENTO)
// ============================================================================
export function iniciarMonitoramentoPedidos() {
    const uid = auth.currentUser?.uid;
    const userProfile = window.userProfile;
    
    if (!uid || !userProfile) return;

    if (unsubscribePedidosAtivos) unsubscribePedidosAtivos();

    if (userProfile.is_provider) {
        // --- VISÃO PRESTADOR ---
        const container = document.getElementById('lista-chamados-ativos');
        if (!container) return;

        const q = query(
            collection(db, "orders"),
            where("provider_id", "==", uid),
            where("status", "in", ["accepted", "in_progress"]),
            orderBy("created_at", "desc")
        );

        unsubscribePedidosAtivos = onSnapshot(q, (snap) => {
            container.innerHTML = "";
            if (snap.empty) {
                container.innerHTML = `<div class="text-center py-6 text-gray-400 text-xs border-2 border-dashed border-gray-200 rounded-xl">Nenhum serviço em execução.</div>`;
                return;
            }
            snap.forEach(doc => renderCardPedido(container, doc.data(), doc.id, true));
        });

    } else {
        // --- VISÃO CLIENTE ---
        const container = document.getElementById('meus-pedidos-andamento');
        if (!container) return;

        const q = query(
            collection(db, "orders"),
            where("client_id", "==", uid),
            where("status", "in", ["pending", "accepted", "in_progress"]), 
            orderBy("created_at", "desc")
        );

        unsubscribePedidosAtivos = onSnapshot(q, (snap) => {
            container.innerHTML = "";
            if (snap.empty) {
                container.innerHTML = `<div class="text-center py-6 text-gray-400 text-xs border-2 border-dashed border-gray-200 rounded-xl">Você não tem pedidos ativos.</div>`;
                return;
            }
            snap.forEach(doc => renderCardPedido(container, doc.data(), doc.id, false));
        });
    }
}

function renderCardPedido(container, pedido, id, isProvider) {
    let statusLabel = "";
    let statusColor = "";
    
    if (pedido.status === 'pending') {
        statusLabel = "🕒 Aguardando Aceite";
        statusColor = "bg-yellow-100 text-yellow-700";
    } else if (pedido.status === 'accepted') {
        statusLabel = "🚗 Prestador a Caminho";
        statusColor = "bg-orange-100 text-orange-700";
    } else if (pedido.status === 'in_progress') {
        statusLabel = "▶️ Em Execução";
        statusColor = "bg-blue-100 text-blue-700 animate-pulse";
    }

    const nomeExibicao = isProvider ? pedido.client_name : (pedido.provider_name || "Prestador");
    
    container.innerHTML += `
        <div onclick="window.abrirChatPedido('${id}')" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 ${pedido.status === 'in_progress' ? 'bg-blue-600' : 'bg-gray-300'}"></div>
            <div>
                <span class="text-[9px] font-bold uppercase tracking-wider ${statusColor} px-2 py-0.5 rounded mb-1 inline-block">${statusLabel}</span>
                <h4 class="font-bold text-gray-800 text-sm">${nomeExibicao}</h4>
                <p class="text-xs text-gray-500">R$ ${pedido.offer_value} • ${pedido.service_date || 'Hoje'}</p>
            </div>
            <button class="bg-blue-50 text-blue-600 p-2 rounded-full">
                💬
            </button>
        </div>
    `;
}

// ============================================================================
// 1. LISTAGEM PRINCIPAL (VITRINE OU MEUS SERVIÇOS)
// ============================================================================
export function carregarServicosDisponiveis() {
    const listaRender = document.getElementById('lista-prestadores-realtime');
    const filtersRender = document.getElementById('category-filters');
    const userProfile = window.userProfile;
    const uid = auth.currentUser?.uid;
    
    iniciarMonitoramentoPedidos();

    if (!listaRender || !filtersRender) return;

    // --- A. VISÃO PRESTADOR (Meus Serviços Cadastrados) ---
    if (userProfile && userProfile.is_provider) {
        filtersRender.classList.add('hidden'); // Esconde filtros da vitrine
        
        // Evita recarregar listener se já existir
        if (unsubscribeMeusServicos) return;

        listaRender.className = "flex flex-col gap-3 pb-24"; 
        listaRender.innerHTML = `
            <div class="text-center py-6">
                <div class="loader mx-auto border-blue-200 border-t-blue-600 mb-2"></div>
                <p class="text-[10px] text-gray-400">Carregando seus serviços...</p>
            </div>
        `;

        // Busca dados do Prestador em 'active_providers' para ver status e serviços
        unsubscribeMeusServicos = onSnapshot(doc(db, "active_providers", uid), (docSnap) => {
            listaRender.innerHTML = ""; // Limpa loader

            if (!docSnap.exists()) {
                listaRender.innerHTML = `
                    <div class="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                        <p class="text-gray-500 text-xs mb-2">Você ainda não configurou seus serviços.</p>
                        <button onclick="window.abrirConfiguracoes()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Configurar Agora</button>
                    </div>`;
                return;
            }

            const data = docSnap.data();
            const servicos = data.services || [];

            if (servicos.length === 0) {
                listaRender.innerHTML = `<div class="text-center py-6 text-gray-400 text-xs">Nenhum serviço cadastrado.</div>`;
                return;
            }

            // Renderiza cada serviço com TARJA INDIVIDUAL
            servicos.forEach(svc => {
                const stSvc = svc.status || 'em_analise';
                let statusBadge = "";
                let statusBorder = "";
                
                if (stSvc === 'aprovado') {
                    statusBadge = `<span class="bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide flex items-center gap-1">✅ Aprovado</span>`;
                    statusBorder = "border-l-4 border-l-green-500";
                } else if (stSvc === 'suspenso' || stSvc === 'reprovado') {
                    statusBadge = `<span class="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide flex items-center gap-1">🔴 Suspenso</span>`;
                    statusBorder = "border-l-4 border-l-red-500";
                } else {
                    statusBadge = `<span class="bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide flex items-center gap-1">⏳ Em Análise</span>`;
                    statusBorder = "border-l-4 border-l-yellow-400";
                }

                listaRender.innerHTML += `
                    <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden ${statusBorder}">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <h3 class="font-bold text-gray-800 text-sm">${svc.category}</h3>
                                <p class="text-[10px] text-gray-500">${svc.description || 'Sem descrição'}</p>
                            </div>
                            ${statusBadge}
                        </div>
                        <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                            <span class="font-black text-blue-900 text-sm">R$ ${svc.price}</span>
                            <button onclick="window.abrirConfiguracoes()" class="text-[10px] text-blue-600 font-bold hover:underline">
                                ✏️ Editar
                            </button>
                        </div>
                    </div>
                `;
            });
        });
        return; 
    }

    // --- B. VISÃO CLIENTE (Vitrine de Prestadores) ---
    // Grid Layout
    listaRender.className = "grid grid-cols-2 md:grid-cols-3 gap-2 pb-24"; 

    // Renderiza Filtros (se vazio)
    if(filtersRender.innerHTML.trim() === "" || !document.getElementById('search-services')) {
        filtersRender.classList.remove('hidden');
        filtersRender.innerHTML = `
            <div class="mb-3 px-1">
                <div class="relative">
                    <span class="absolute left-3 top-2.5 text-gray-400 text-xs">🔍</span>
                    <input type="text" id="search-services" oninput="window.filtrarPorTexto(this.value)" 
                        placeholder="Buscar (Ex: Eletricista...)" 
                        class="w-full bg-white border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs font-bold text-gray-700 outline-none focus:border-blue-500 transition shadow-sm">
                </div>
            </div>
            <div class="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2 px-1">
                <button onclick="window.filtrarCategoria('Todos', this)" class="filter-pill active bg-blue-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold border border-blue-600 shadow-sm whitespace-nowrap">Todos</button>
                <button onclick="window.filtrarCategoria('Limpeza', this)" class="filter-pill bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full text-[10px] font-bold hover:bg-gray-50 whitespace-nowrap">Limpeza</button>
                <button onclick="window.filtrarCategoria('Obras', this)" class="filter-pill bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full text-[10px] font-bold hover:bg-gray-50 whitespace-nowrap">Obras</button>
                <button onclick="window.filtrarCategoria('Técnica', this)" class="filter-pill bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full text-[10px] font-bold hover:bg-gray-50 whitespace-nowrap">Técnica</button>
                <button onclick="window.filtrarCategoria('Outros', this)" class="filter-pill bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full text-[10px] font-bold hover:bg-gray-50 whitespace-nowrap">Outros</button>
            </div>
        `;
    }

    if (unsubscribeVitrine) return;

    listaRender.innerHTML = `
        <div class="col-span-2 text-center py-10">
            <div class="loader mx-auto border-blue-200 border-t-blue-600 mb-2"></div>
            <p class="text-[10px] text-gray-400">Carregando vitrine...</p>
        </div>
    `;

    try {
        const q = query(
            collection(db, "active_providers"), 
            orderBy("visibility_score", "desc"), 
            limit(50)
        );
        
        unsubscribeVitrine = onSnapshot(q, (snap) => {
            cachePrestadores = []; 

            if (snap.empty) {
                listaRender.innerHTML = `
                    <div class="col-span-2 text-center py-12 opacity-60">
                        <div class="text-4xl mb-2 grayscale">🏜️</div>
                        <h3 class="font-bold text-gray-700 text-xs">Nenhum profissional disponível.</h3>
                    </div>`;
                return;
            }

            snap.forEach(d => {
                cachePrestadores.push({ id: d.id, ...d.data() });
            });

            // 🔥 FILTRO DE SEGURANÇA NA VITRINE: Só mostra se tiver serviço aprovado
            const validos = cachePrestadores.filter(p => {
                if(!p.services) return false;
                // Filtra apenas serviços aprovados para contar
                const aprovados = p.services.filter(s => s.status === 'aprovado');
                return aprovados.length > 0;
            });
            
            renderizarLista(validos);
        });

    } catch (e) {
        console.error("Erro ao conectar vitrine:", e);
        listaRender.innerHTML = `<p class="col-span-2 text-center text-red-500 text-xs">Erro de conexão.</p>`;
    }
}

// 🔎 BUSCA E FILTROS (Vitrine)
function filtrarPorTexto(texto) {
    const termo = normalizarTexto(texto);
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.remove('active', 'bg-blue-600', 'text-white', 'border-blue-600');
        btn.classList.add('bg-white', 'text-gray-600', 'border-gray-200');
    });

    if (termo === "") {
        const btnTodos = document.querySelector("button[onclick*='Todos']");
        if(btnTodos) {
            btnTodos.classList.add('active', 'bg-blue-600', 'text-white', 'border-blue-600');
            btnTodos.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
        }
        renderizarLista(cachePrestadores);
        return;
    }

    const filtrados = cachePrestadores.filter(p => {
        if (!p.services) return false;
        // Filtra só serviços aprovados na busca
        const aprovados = p.services.filter(s => s.status === 'aprovado');
        if (aprovados.length === 0) return false;

        const matchNome = normalizarTexto(p.nome_profissional).includes(termo);
        const matchBio = normalizarTexto(p.bio).includes(termo);
        const matchServico = aprovados.some(s => normalizarTexto(s.category).includes(termo) || normalizarTexto(s.description).includes(termo));
        return matchNome || matchBio || matchServico;
    });

    renderizarLista(filtrados);
}

function filtrarCategoria(categoria, btnElement) {
   const inputBusca = document.getElementById('search-services');
   if(inputBusca) inputBusca.value = "";

   if(btnElement) {
       document.querySelectorAll('.filter-pill').forEach(btn => {
           btn.className = "filter-pill bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full text-[10px] font-bold hover:bg-gray-50 transition whitespace-nowrap";
       });
       btnElement.className = "filter-pill active bg-blue-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold border border-blue-600 shadow-sm transition whitespace-nowrap";
   }

   if (categoria === 'Todos') {
       renderizarLista(cachePrestadores);
   } else {
       const filtrados = cachePrestadores.filter(p => {
           if (!p.services) return false;
           // Filtra só serviços aprovados na categoria
           const aprovados = p.services.filter(s => s.status === 'aprovado');
           if (aprovados.length === 0) return false;

           if (categoria === 'Outros') {
               return aprovados.some(s => !['Limpeza', 'Obras', 'Técnica'].some(c => s.category.includes(c)));
           }
           return aprovados.some(s => s.category.includes(categoria));
       });
       renderizarLista(filtrados);
   }
}

// LÓGICA DE RENDERIZAÇÃO DA VITRINE
function renderizarLista(lista) {
    const container = document.getElementById('lista-prestadores-realtime');
    container.innerHTML = "";

    lista.forEach(prestador => {
        const isOnline = prestador.is_online === true;
        const isAprovado = prestador.status === 'aprovado';
        
        if(!isAprovado) return; 

        // 🔥 FILTRO FINAL: Só considera serviços aprovados para exibição
        const servicosAprovados = (prestador.services || []).filter(s => s.status === 'aprovado');
        if (servicosAprovados.length === 0) return; // Não mostra prestador sem serviço aprovado

        const nomeSafe = prestador.nome_profissional || "Profissional";
        const primeiroNome = nomeSafe.split(' ')[0];
        const fotoPerfil = prestador.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeSafe)}&background=random&color=fff`;
        
        const servicoPrincipal = servicosAprovados[0]; // Pega o primeiro aprovado
        const qtdServicos = servicosAprovados.length;
        
        let botaoAcaoHTML = "";
        let containerClass = "bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 relative flex flex-col";
        
        if(isOnline) {
            botaoAcaoHTML = `
                <div class="mt-2 bg-blue-600 text-white text-[10px] font-black py-1.5 rounded text-center uppercase tracking-wide flex items-center justify-center gap-1 shadow-sm group-hover:bg-blue-700 transition">
                    <span>⚡</span> Solicitar
                </div>
            `;
        } else {
            containerClass += " opacity-90";
            botaoAcaoHTML = `
                <div class="mt-2 bg-gray-100 text-gray-600 text-[10px] font-bold py-1.5 rounded text-center uppercase tracking-wide flex items-center justify-center gap-1 border border-gray-200">
                    <span>📅</span> Agendar
                </div>
            `;
        }

        const onclickAction = `window.abrirModalContratacao('${prestador.id}')`;

        container.innerHTML += `
            <div class="${containerClass} group" onclick="${onclickAction}">
                <div class="absolute top-2 right-2 z-10">
                    ${isOnline 
                        ? '<span class="flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 border border-white"></span></span>' 
                        : '<div class="w-2.5 h-2.5 bg-gray-300 rounded-full border border-white"></div>'}
                </div>

                <div class="h-14 w-full bg-gradient-to-r from-blue-600 to-blue-400 relative"></div>
                <div class="flex justify-center -mt-7 relative px-2">
                    <img src="${fotoPerfil}" class="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover bg-white">
                </div>

                <div class="p-2 text-center flex-1 flex flex-col justify-between">
                    <div>
                        <h3 class="font-black text-gray-800 text-xs truncate mt-0.5">${primeiroNome}</h3>
                        <p class="text-[9px] text-gray-400 truncate mb-1">⭐ 5.0 • ${qtdServicos} svcs</p>
                        
                        <div class="bg-blue-50 rounded py-0.5 px-2 mb-1">
                            <p class="font-bold text-blue-900 text-[9px] truncate">${servicoPrincipal.category}</p>
                        </div>
                    </div>
                    
                    <div>
                        <p class="font-black text-green-600 text-xs">R$ ${servicoPrincipal.price}</p>
                        ${botaoAcaoHTML} 
                    </div>
                </div>
            </div>
        `;
    });
}

// ============================================================================
// 2. MODAL DE CONTRATAÇÃO
// ============================================================================
export function abrirModalContratacao(providerId) {
    const prestador = cachePrestadores.find(p => p.id === providerId);
    
    if (!prestador) {
        return alert("Erro: Dados não encontrados. Atualize a página.");
    }

    // Filtra apenas serviços aprovados para o modal de contratação
    const servicosAprovados = (prestador.services || []).filter(s => s.status === 'aprovado');

    if (servicosAprovados.length > 1) {
        abrirPerfilPublico(prestador);
    } else if (servicosAprovados.length === 1) {
        const servico = servicosAprovados[0];
        if (window.abrirModalSolicitacao) {
            window.abrirModalSolicitacao(providerId, prestador.nome_profissional, servico.price); 
        }
    } else {
        alert("Este prestador não possui serviços aprovados disponíveis.");
    }
}

function abrirPerfilPublico(prestador) {
    const modal = document.getElementById('provider-profile-modal');
    if(!modal) return;

    document.getElementById('public-profile-photo').src = prestador.foto_perfil || "https://ui-avatars.com/api/?name=User";
    document.getElementById('public-profile-name').innerText = prestador.nome_profissional;

    const listaContainer = document.getElementById('public-services-list');
    listaContainer.innerHTML = "";

    // Só mostra serviços aprovados no perfil público
    const servicosAprovados = (prestador.services || []).filter(s => s.status === 'aprovado');

    servicosAprovados.forEach(svc => {
        listaContainer.innerHTML += `
            <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center hover:bg-blue-50 transition">
                <div>
                    <span class="block font-bold text-xs text-blue-900">${svc.category}</span>
                    <span class="text-[10px] text-gray-500">${svc.description || "Serviço padrão"}</span>
                </div>
                <button onclick="window.abrirModalSolicitacao('${prestador.id}', '${prestador.nome_profissional.replace(/'/g, "\\'")}', ${svc.price}); window.fecharPerfilPublico();" class="bg-green-600 text-white text-[10px] font-bold px-3 py-1.5 rounded shadow-sm hover:bg-green-700">
                    R$ ${svc.price}
                </button>
            </div>
        `;
    });

    modal.classList.remove('hidden');
}
