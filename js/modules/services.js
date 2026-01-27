import { db, auth } from '../app.js';
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let cachePrestadores = [];

// --- GATILHOS ---
const tabServicos = document.getElementById('tab-servicos');
if (tabServicos) {
    tabServicos.addEventListener('click', () => {
        carregarServicosDisponiveis();
    });
}

// Expõe globalmente
window.carregarServicos = carregarServicosDisponiveis;
window.abrirModalContratacao = abrirModalContratacao; // Agora aponta para a função corrigida abaixo
window.filtrarCategoria = filtrarCategoria;

// ============================================================================
// 1. LISTAGEM DE SERVIÇOS
// ============================================================================
export async function carregarServicosDisponiveis() {
    const listaRender = document.getElementById('lista-prestadores-realtime');
    const filtersRender = document.getElementById('category-filters');
    
    if (!listaRender || !filtersRender) return;

    // Renderiza filtros (Visual)
    if(filtersRender.innerHTML.trim() === "") {
        filtersRender.classList.remove('hidden');
        filtersRender.innerHTML = `
            <div class="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button onclick="window.filtrarCategoria('Todos', this)" class="filter-pill active bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold border border-blue-600 shadow-md">Todos</button>
                <button onclick="window.filtrarCategoria('Limpeza', this)" class="filter-pill bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold hover:bg-gray-50">Limpeza</button>
                <button onclick="window.filtrarCategoria('Obras', this)" class="filter-pill bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold hover:bg-gray-50">Obras</button>
                <button onclick="window.filtrarCategoria('Técnica', this)" class="filter-pill bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold hover:bg-gray-50">Técnica</button>
                <button onclick="window.filtrarCategoria('Outros', this)" class="filter-pill bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold hover:bg-gray-50">Outros</button>
            </div>
        `;
    }

    listaRender.innerHTML = `
        <div class="col-span-2 text-center py-10">
            <div class="loader mx-auto border-blue-200 border-t-blue-600 mb-2"></div>
            <p class="text-[10px] text-gray-400">Buscando profissionais...</p>
        </div>
    `;

    try {
        const q = query(
            collection(db, "active_providers"), 
            orderBy("visibility_score", "desc"), 
            limit(50)
        );
        
        const snap = await getDocs(q);
        cachePrestadores = []; 

        if (snap.empty) {
            listaRender.innerHTML = `
                <div class="col-span-2 text-center py-12 opacity-60">
                    <div class="text-5xl mb-3 grayscale">🏜️</div>
                    <h3 class="font-bold text-gray-700">Nenhum profissional encontrado.</h3>
                </div>`;
            return;
        }

        snap.forEach(d => {
            cachePrestadores.push({ id: d.id, ...d.data() });
        });

        renderizarLista(cachePrestadores);

    } catch (e) {
        console.error("Erro ao carregar serviços:", e);
        listaRender.innerHTML = `<p class="col-span-2 text-center text-red-500 text-xs">Erro de conexão.</p>`;
    }
}

function filtrarCategoria(categoria, btnElement) {
    if(btnElement) {
        document.querySelectorAll('.filter-pill').forEach(btn => {
            btn.className = "filter-pill bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold hover:bg-gray-50 transition";
        });
        btnElement.className = "filter-pill active bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold border border-blue-600 shadow-md transition";
    }

    const listaRender = document.getElementById('lista-prestadores-realtime');
    
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
        
        if(filtrados.length === 0) {
            listaRender.innerHTML = `<div class="col-span-2 text-center py-10 opacity-50"><p class="text-xs">Nenhum resultado para ${categoria}.</p></div>`;
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
        const nomeSafe = prestador.nome_profissional || "Profissional";
        const fotoPerfil = prestador.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeSafe)}&background=random&color=fff`;
        const bannerStyle = prestador.banner_url 
            ? `background-image: url('${prestador.banner_url}');` 
            : `background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);`; 
        const bio = prestador.bio || "Profissional verificado.";
        
        const servicoPrincipal = (prestador.services && prestador.services.length > 0) 
            ? prestador.services[0] 
            : { category: "Geral", price: 0 };

        let statusDot = isOnline 
            ? `<div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" title="Online"></div>`
            : `<div class="absolute bottom-0 right-0 w-3 h-3 bg-gray-400 border-2 border-white rounded-full" title="Offline"></div>`;
        
        let containerClass = "bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group relative";
        if(!isOnline) containerClass += " grayscale opacity-90";

        // AQUI ESTAVA O PROBLEMA: Chamava uma função local antiga.
        // CORREÇÃO: Agora chamamos 'abrirModalContratacao' que vai redirecionar para a lógica certa.
        const onclickAction = `window.abrirModalContratacao('${prestador.id}', '${nomeSafe}', '${servicoPrincipal.category}', ${servicoPrincipal.price})`;

        container.innerHTML += `
            <div class="${containerClass}">
                <div class="h-20 w-full bg-cover bg-center relative" style="${bannerStyle}">
                    <div class="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition"></div>
                </div>

                <div class="px-4 relative">
                    <div class="absolute -top-6 left-4">
                        <img src="${fotoPerfil}" class="w-12 h-12 rounded-full border-4 border-white shadow-md object-cover bg-white">
                        ${statusDot}
                    </div>
                </div>

                <div class="pt-8 px-4 pb-4">
                    <div class="mb-2">
                        <h3 class="font-black text-gray-800 text-sm leading-tight truncate">${nomeSafe}</h3>
                        <div class="flex items-center gap-1 mt-1">
                            <span class="text-[9px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded-full">⭐ 5.0</span>
                            <span class="text-[9px] text-gray-400 truncate flex-1">${bio}</span>
                        </div>
                    </div>

                    <div class="bg-gray-50 rounded-lg p-2 border border-gray-100 flex justify-between items-center mb-3">
                        <div>
                            <p class="text-[8px] uppercase font-bold text-gray-400 tracking-wider">Serviço</p>
                            <p class="font-bold text-blue-900 text-xs truncate max-w-[100px]">${servicoPrincipal.category}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[8px] text-gray-400">Base</p>
                            <p class="font-black text-green-600 text-sm">R$ ${servicoPrincipal.price}</p>
                        </div>
                    </div>

                    <button onclick="${onclickAction}" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-wide shadow-md transform active:scale-95 transition">
                        ${isOnline ? 'Ver & Contratar' : '📅 Agendar'}
                    </button>
                </div>
            </div>
        `;
    });
}

// ============================================================================
// 2. MODAL DE CONTRATAÇÃO (CORREÇÃO DE PONTE)
// ============================================================================
export function abrirModalContratacao(providerId, providerName, category, price) {
    // CORREÇÃO CRÍTICA:
    // Em vez de tentar abrir o modal sozinho e quebrar as variáveis,
    // nós delegamos para o request.js (que é o dono da lógica de pedidos).
    
    if (window.abrirModalSolicitacao) {
        // Redireciona para a função poderosa do request.js
        window.abrirModalSolicitacao(providerId, providerName, price);
    } else {
        console.error("ERRO: O módulo request.js não carregou a função 'abrirModalSolicitacao'.");
        alert("Erro interno: Tente recarregar a página.");
    }
}
