import { db, auth } from '../app.js';
import { collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let cachePrestadores = [];
let unsubscribeVitrine = null;

// --- GATILHOS ---
const tabServicos = document.getElementById('tab-servicos');
if (tabServicos) {
    tabServicos.addEventListener('click', () => {
        carregarServicosDisponiveis();
    });
}

// Expõe globalmente
window.carregarServicos = carregarServicosDisponiveis;
window.abrirModalContratacao = abrirModalContratacao;
window.filtrarCategoria = filtrarCategoria;
window.filtrarPorTexto = filtrarPorTexto;
window.fecharPerfilPublico = () => document.getElementById('provider-profile-modal')?.classList.add('hidden');

// --- FUNÇÃO AUXILIAR: REMOVE ACENTOS E MAIÚSCULAS ---
function normalizarTexto(texto) {
    if (!texto) return "";
    return texto
        .normalize('NFD') // Separa os acentos das letras
        .replace(/[\u0300-\u036f]/g, "") // Remove os acentos
        .toLowerCase(); // Tudo minúsculo
}

// ============================================================================
// 1. LISTAGEM DE SERVIÇOS (TEMPO REAL & GRID)
// ============================================================================
export function carregarServicosDisponiveis() {
    const listaRender = document.getElementById('lista-prestadores-realtime');
    const filtersRender = document.getElementById('category-filters');
    const userProfile = window.userProfile;
    
    if (!listaRender || !filtersRender) return;

    // 🔒 TRAVA DE SEGURANÇA (Prestador não vê filtros/busca)
    if (userProfile && userProfile.is_provider) {
        filtersRender.classList.add('hidden');
        return; 
    }

    // 🎨 LAYOUT GRID
    listaRender.className = "grid grid-cols-2 md:grid-cols-3 gap-2 pb-24"; 

    // 🔎 BARRA DE PESQUISA + FILTROS
    if(filtersRender.innerHTML.trim() === "" || !document.getElementById('search-services')) {
        filtersRender.classList.remove('hidden');
        filtersRender.innerHTML = `
            <div class="mb-3 px-1">
                <div class="relative">
                    <span class="absolute left-3 top-2.5 text-gray-400 text-xs">🔍</span>
                    <input type="text" id="search-services" oninput="window.filtrarPorTexto(this.value)" 
                        placeholder="Buscar (Ex: Tecnico, Joao...)" 
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
                        <h3 class="font-bold text-gray-700 text-xs">Nenhum profissional online.</h3>
                    </div>`;
                return;
            }

            snap.forEach(d => {
                cachePrestadores.push({ id: d.id, ...d.data() });
            });

            // Renderiza inicial (Todos)
            const validos = cachePrestadores.filter(p => p.services && p.services.length > 0);
            renderizarLista(validos);
        });

    } catch (e) {
        console.error("Erro ao conectar vitrine:", e);
        listaRender.innerHTML = `<p class="col-span-2 text-center text-red-500 text-xs">Erro de conexão.</p>`;
    }
}

// 🔎 BUSCA INTELIGENTE (SEM ACENTOS)
function filtrarPorTexto(texto) {
    const termo = normalizarTexto(texto); // Limpa o que o usuário digitou
    
    // Reseta botões de categoria visualmente
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
        
        // Limpa os dados do banco antes de comparar
        const matchNome = normalizarTexto(p.nome_profissional).includes(termo);
        const matchBio = normalizarTexto(p.bio).includes(termo);
        const matchServico = p.services.some(s => 
            normalizarTexto(s.category).includes(termo) || 
            normalizarTexto(s.description).includes(termo)
        );

        return matchNome || matchBio || matchServico;
    });

    const container = document.getElementById('lista-prestadores-realtime');
    if(filtrados.length === 0) {
        container.innerHTML = `
            <div class="col-span-2 text-center py-10 opacity-50">
                <p class="text-xs">Nenhum resultado para "<b>${texto}</b>".</p>
            </div>`;
    } else {
        renderizarLista(filtrados);
    }
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
            if (categoria === 'Outros') {
                return p.services.some(s => !['Limpeza', 'Obras', 'Técnica'].some(c => s.category.includes(c)));
            }
            return p.services.some(s => s.category.includes(categoria));
        });
        
        const container = document.getElementById('lista-prestadores-realtime');
        if(filtrados.length === 0) {
            container.innerHTML = `<div class="col-span-2 text-center py-10 opacity-50"><p class="text-xs">Nenhum resultado para ${categoria}.</p></div>`;
        } else {
            renderizarLista(filtrados);
        }
    }
}

function renderizarLista(lista) {
    const container = document.getElementById('lista-prestadores-realtime');
    container.innerHTML = "";

    lista.forEach(prestador => {
        const isOnline = prestador.is_online === true;
        const isAprovado = prestador.status === 'aprovado';
        
        if(!isAprovado) return; 

        const nomeSafe = prestador.nome_profissional || "Profissional";
        const primeiroNome = nomeSafe.split(' ')[0];
        const fotoPerfil = prestador.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeSafe)}&background=random&color=fff`;
        
        const servicoPrincipal = (prestador.services && prestador.services.length > 0) 
            ? prestador.services[0] 
            : { category: "Geral", price: 0 };

        const qtdServicos = prestador.services ? prestador.services.length : 0;
        
        let containerClass = "bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 relative flex flex-col";
        if(!isOnline) containerClass += " grayscale opacity-70";

        const onclickAction = `window.abrirModalContratacao('${prestador.id}')`;

        container.innerHTML += `
            <div class="${containerClass}" onclick="${onclickAction}">
                <div class="absolute top-2 right-2 z-10">
                    ${isOnline 
                        ? '<span class="flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 border border-white"></span></span>' 
                        : '<div class="w-2.5 h-2.5 bg-gray-300 rounded-full border border-white"></div>'}
                </div>

                <div class="h-16 w-full bg-gradient-to-r from-blue-600 to-blue-400 relative"></div>
                <div class="flex justify-center -mt-8 relative px-2">
                    <img src="${fotoPerfil}" class="w-14 h-14 rounded-full border-2 border-white shadow-sm object-cover bg-white">
                </div>

                <div class="p-2 text-center flex-1 flex flex-col justify-between">
                    <div>
                        <h3 class="font-black text-gray-800 text-xs truncate mt-1">${primeiroNome}</h3>
                        <p class="text-[9px] text-gray-400 truncate mb-1">⭐ 5.0 • ${qtdServicos} svcs</p>
                        
                        <div class="bg-blue-50 rounded py-1 px-2 mb-1">
                            <p class="font-bold text-blue-900 text-[10px] truncate">${servicoPrincipal.category}</p>
                        </div>
                    </div>
                    
                    <div>
                        <p class="text-[10px] text-gray-400 mb-0.5">A partir de</p>
                        <p class="font-black text-green-600 text-xs">R$ ${servicoPrincipal.price}</p>
                    </div>
                </div>
            </div>
        `;
    });
}

// ============================================================================
// 2. MODAL DE CONTRATAÇÃO INTELIGENTE
// ============================================================================
export function abrirModalContratacao(providerId) {
    console.log("🖱️ Clique detectado para ID:", providerId);

    const prestador = cachePrestadores.find(p => p.id === providerId);
    
    if (!prestador) {
        console.warn("⚠️ Prestador não encontrado no cache. Tentando recarregar...");
        return alert("Erro: Dados do prestador não encontrados. Atualize a página.");
    }

    if (prestador.services && prestador.services.length > 1) {
        console.log("📂 Abrindo Perfil (Múltiplos Serviços)");
        abrirPerfilPublico(prestador);
    } else {
        console.log("🚀 Abrindo Pedido Direto (1 Serviço)");
        const servico = prestador.services[0];
        if (window.abrirModalSolicitacao) {
            window.abrirModalSolicitacao(providerId, prestador.nome_profissional, servico.price); 
        }
    }
}

function abrirPerfilPublico(prestador) {
    const modal = document.getElementById('provider-profile-modal');
    if(!modal) return console.error("❌ Modal 'provider-profile-modal' não encontrado no HTML.");

    document.getElementById('public-profile-photo').src = prestador.foto_perfil || "https://ui-avatars.com/api/?name=User";
    document.getElementById('public-profile-name').innerText = prestador.nome_profissional;

    const listaContainer = document.getElementById('public-services-list');
    listaContainer.innerHTML = "";

    prestador.services.forEach(svc => {
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
