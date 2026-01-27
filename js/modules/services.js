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
window.fecharPerfilPublico = () => document.getElementById('provider-profile-modal')?.classList.add('hidden');

// ============================================================================
// 1. LISTAGEM DE SERVIÇOS (TEMPO REAL)
// ============================================================================
export function carregarServicosDisponiveis() {
    const listaRender = document.getElementById('lista-prestadores-realtime');
    const filtersRender = document.getElementById('category-filters');
    
    if (!listaRender || !filtersRender) return;

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

    if (unsubscribeVitrine) return;

    listaRender.innerHTML = `
        <div class="col-span-2 text-center py-10">
            <div class="loader mx-auto border-blue-200 border-t-blue-600 mb-2"></div>
            <p class="text-[10px] text-gray-400">Conectando ao vivo...</p>
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
                        <div class="text-5xl mb-3 grayscale">🏜️</div>
                        <h3 class="font-bold text-gray-700">Nenhum profissional online.</h3>
                    </div>`;
                return;
            }

            snap.forEach(d => {
                cachePrestadores.push({ id: d.id, ...d.data() });
            });

            const validos = cachePrestadores.filter(p => p.services && p.services.length > 0);
            renderizarLista(validos);
        });

    } catch (e) {
        console.error("Erro ao conectar vitrine:", e);
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
        const fotoPerfil = prestador.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeSafe)}&background=random&color=fff`;
        const bannerStyle = prestador.banner_url 
            ? `background-image: url('${prestador.banner_url}');` 
            : `background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);`; 
        const bio = prestador.bio || "Profissional verificado.";
        
        const servicoPrincipal = (prestador.services && prestador.services.length > 0) 
            ? prestador.services[0] 
            : { category: "Geral", price: 0 };

        const qtdServicos = prestador.services ? prestador.services.length : 0;
        
        // ✨ CORREÇÃO VISUAL: Badge muito mais destacado
        const badgeMais = qtdServicos > 1 
            ? `<span class="ml-2 text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 font-bold shadow-sm animate-pulse">✨ +${qtdServicos - 1} opções</span>` 
            : '';

        let statusDot = isOnline 
            ? `<div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" title="Online"></div>`
            : `<div class="absolute bottom-0 right-0 w-3 h-3 bg-gray-400 border-2 border-white rounded-full" title="Offline"></div>`;
        
        let containerClass = "bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group relative";
        if(!isOnline) containerClass += " grayscale opacity-90";

        // 🛡️ CORREÇÃO DE CLIQUE: Passamos APENAS o ID para evitar erros de aspas no nome
        const onclickAction = `window.abrirModalContratacao('${prestador.id}')`;

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
                            <p class="text-[8px] uppercase font-bold text-gray-400 tracking-wider">Serviço Principal</p>
                            <div class="flex items-center">
                                <p class="font-bold text-blue-900 text-xs truncate max-w-[100px]">${servicoPrincipal.category}</p>
                                ${badgeMais}
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-[8px] text-gray-400">A partir de</p>
                            <p class="font-black text-green-600 text-sm">R$ ${servicoPrincipal.price}</p>
                        </div>
                    </div>

                    <button onclick="${onclickAction}" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-wide shadow-md transform active:scale-95 transition">
                        ${isOnline ? (qtdServicos > 1 ? 'Ver Opções' : 'Contratar') : '📅 Agendar'}
                    </button>
                </div>
            </div>
        `;
    });
}

// ============================================================================
// 2. MODAL DE CONTRATAÇÃO INTELIGENTE (ITEM 2.1)
// ============================================================================
export function abrirModalContratacao(providerId) {
    console.log("🖱️ Clique detectado para ID:", providerId);

    // 1. Busca os dados completos do prestador no cache
    const prestador = cachePrestadores.find(p => p.id === providerId);
    
    if (!prestador) {
        console.warn("⚠️ Prestador não encontrado no cache. Tentando recarregar...");
        return alert("Erro: Dados do prestador não encontrados. Atualize a página.");
    }

    // 2. Decisão: Tem muitos serviços?
    if (prestador.services && prestador.services.length > 1) {
        console.log("📂 Abrindo Perfil (Múltiplos Serviços)");
        abrirPerfilPublico(prestador);
    } else {
        console.log("🚀 Abrindo Pedido Direto (1 Serviço)");
        const servico = prestador.services[0];
        if (window.abrirModalSolicitacao) {
            // Passa o nome recuperado do objeto, não do clique
            window.abrirModalSolicitacao(providerId, prestador.nome_profissional, servico.price); 
        }
    }
}

function abrirPerfilPublico(prestador) {
    const modal = document.getElementById('provider-profile-modal');
    if(!modal) return console.error("❌ Modal 'provider-profile-modal' não encontrado no HTML.");

    // Popula Dados
    document.getElementById('public-profile-photo').src = prestador.foto_perfil || "https://ui-avatars.com/api/?name=User";
    document.getElementById('public-profile-name').innerText = prestador.nome_profissional;
    // document.getElementById('public-profile-rating').innerText = "5.0"; // Futuro: Item 9.1

    // Popula Lista de Serviços
    const listaContainer = document.getElementById('public-services-list');
    listaContainer.innerHTML = "";

    prestador.services.forEach(svc => {
        // Cada serviço tem seu próprio botão de contratar
        // OBS: Aqui também passamos os dados de forma segura
        // Mas como o nome está dentro de uma string template JS, usamos aspas escapadas se necessário, 
        // ou melhor, passamos o nome do objeto prestador que já foi validado.
        
        // Simplificação Segura:
        const btnId = `btn-svc-${Math.random().toString(36).substr(2, 9)}`;
        
        const htmlItem = `
            <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center hover:bg-blue-50 transition">
                <div>
                    <span class="block font-bold text-xs text-blue-900">${svc.category}</span>
                    <span class="text-[10px] text-gray-500">${svc.description || "Serviço padrão"}</span>
                </div>
                <button id="${btnId}" class="bg-green-600 text-white text-[10px] font-bold px-3 py-1.5 rounded shadow-sm hover:bg-green-700">
                    R$ ${svc.price}
                </button>
            </div>
        `;
        
        // Injeção segura do evento onclick via AddEventListener não é viável com innerHTML string
        // Voltamos ao onclick inline mas com tratamento de aspas
        
        // TRUQUE DO NOME: Usamos uma variável global temporária se o nome for complexo, 
        // ou assumimos que o nome já está limpo.
        // Vamos usar a função direta passando o ID de novo, e buscando o nome dentro do modalSolicitacao se precisar.
        // MAS para facilitar, vamos passar o nome do prestador que temos aqui no escopo.
        
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
