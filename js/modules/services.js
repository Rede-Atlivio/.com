import { db, auth } from '../app.js';
import { collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function carregarCatalogoServicos() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;

    // Feedback visual imediato antes de buscar
    container.innerHTML = `
        <div class="col-span-2 text-center py-10 animate-pulse">
            <div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div>
            <p class="text-[9px] text-gray-400">Carregando profissionais...</p>
        </div>`;

    try {
        // --- MUDANÇA PRINCIPAL: Removemos o filtro 'where("is_online", "==", true)' ---
        // Agora buscamos TODOS os prestadores ativos, ordenados por visibilidade.
        // Isso preenche a tela e dá sensação de "App Cheio".
        const q = query(
            collection(db, "active_providers"), 
            orderBy("visibility_score", "desc"), 
            limit(20)
        );
        
        const snapshot = await getDocs(q);
        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-xs">Nenhum profissional encontrado na região.</div>`;
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const servico = data.services && data.services.length > 0 ? data.services[0] : { category: "Geral", price: 0 };
            
            // --- LÓGICA DE STATUS ---
            const isDemo = data.is_demo === true || data.is_seed === true;
            const isOnline = data.is_online === true; // Verifica se está online de verdade
            
            // --- ESTILOS VISUAIS (O SEGREDO) ---
            let cardOpacity = "";
            let badgeHtml = "";
            let btnHtml = "";
            let extraHtml = ""; 

            // 1. Lógica para DEMO (Prioridade Visual)
            if (isDemo) {
                cardOpacity = "opacity-90";
                badgeHtml = `<span class="bg-gray-100 text-gray-500 text-[8px] px-2 py-0.5 rounded border border-gray-200 uppercase tracking-wide">Exemplo</span>`;
                
                btnHtml = `
                    <button onclick="alert('🚧 MODO DEMONSTRAÇÃO\\n\\nEste é um perfil de exemplo.')" class="w-full bg-gray-700 hover:bg-gray-800 text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition">
                        Ver como funciona
                    </button>`;
                
                extraHtml = `<p class="text-[7px] text-gray-400 mt-2 text-center italic border-t border-gray-100 pt-1">Conteúdo demonstrativo.</p>`;
            
            } else if (isOnline) {
                // 2. Lógica para ONLINE (Verde e Ativo)
                cardOpacity = ""; // Opacidade total (vívido)
                badgeHtml = `<span class="bg-green-100 text-green-700 text-[8px] px-2 py-0.5 rounded border border-green-200 uppercase tracking-wide">● Online</span>`;
                
                // Escapar aspas no nome para não quebrar o HTML
                const safeName = data.nome_profissional ? data.nome_profissional.replace(/'/g, "\\'") : "Profissional";
                
                btnHtml = `
                    <button onclick="abrirSolicitacao('${doc.id}', '${safeName}', ${servico.price})" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition shadow-sm">
                        SOLICITAR AGORA
                    </button>`;
            
            } else {
                // 3. Lógica para OFFLINE (Cinza e Desativado)
                cardOpacity = "opacity-60 grayscale-[0.8]"; // Deixa cinza e meio apagado
                badgeHtml = `<span class="bg-gray-100 text-gray-400 text-[8px] px-2 py-0.5 rounded border border-gray-200 uppercase tracking-wide">○ Offline</span>`;
                
                btnHtml = `
                    <button disabled class="w-full bg-gray-200 text-gray-400 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-not-allowed">
                        INDISPONÍVEL
                    </button>`;
            }

            // Renderização do Card
            container.innerHTML += `
                <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between ${cardOpacity} animate-fadeIn relative">
                    <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <img src="${data.foto_perfil || 'https://ui-avatars.com/api/?background=random'}" class="w-8 h-8 rounded-full object-cover border border-gray-100">
                            <div>
                                <h4 class="font-bold text-xs text-gray-800 line-clamp-1">${data.nome_profissional || 'Profissional'}</h4>
                                <div class="flex items-center gap-1">${badgeHtml}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <p class="text-[10px] text-gray-500 uppercase font-bold">${servico.category}</p>
                        <p class="text-xs font-black text-blue-900">R$ ${servico.price},00 <span class="text-[8px] font-normal text-gray-400">/estimado</span></p>
                    </div>

                    ${btnHtml}
                    ${extraHtml}
                </div>
            `;
        });

    } catch (e) {
        console.error("Error loading services:", e);
        container.innerHTML = `<div class="col-span-2 text-center text-red-400 text-xs">Erro de conexão.</div>`;
    }
}

// --- DISPARADORES ---
window.carregarCatalogoServicos = carregarCatalogoServicos;

const tabBtn = document.getElementById('tab-servicos');
if(tabBtn) {
    tabBtn.addEventListener('click', () => {
        carregarCatalogoServicos();
    });
}

if(document.getElementById('sec-servicos') && !document.getElementById('sec-servicos').classList.contains('hidden')){
    carregarCatalogoServicos();
}
