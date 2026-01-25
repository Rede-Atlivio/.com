import { db, auth } from '../app.js';
import { collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function carregarCatalogoServicos() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;

    container.innerHTML = `
        <div class="col-span-2 text-center py-10">
            <div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div>
            <p class="text-[9px] text-gray-400">Buscando profissionais...</p>
        </div>`;

    try {
        // --- ORDENAÇÃO POR SCORE (Reais > Simulados) ---
        const q = query(
            collection(db, "active_providers"), 
            where("is_online", "==", true), 
            orderBy("visibility_score", "desc"), // Ordena score alto primeiro
            limit(20)
        );
        
        const snapshot = await getDocs(q);

        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-xs">Nenhum prestador na região agora.</div>`;
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const servico = data.services && data.services.length > 0 ? data.services[0] : { category: "Geral", price: 0 };
            
            // --- LÓGICA DE PROTEÇÃO DE MARCA (SIMULADO/DEMO) ---
            const isDemo = data.is_demo === true || data.is_seed === true;
            
            // Badge e Estilo
            const badgeDemo = isDemo 
                ? `<span class="bg-gray-100 text-gray-500 text-[8px] px-2 py-0.5 rounded border border-gray-200 uppercase tracking-wide">Exemplo</span>` 
                : `<span class="bg-green-100 text-green-700 text-[8px] px-2 py-0.5 rounded border border-green-200 uppercase tracking-wide">● Online</span>`;
            
            const opacityClass = isDemo ? "opacity-75 grayscale-[0.3]" : "";
            
            // Ação do Botão (Travada para Demos)
            const btnText = isDemo ? "Indisponível" : "Solicitar";
            const btnColor = isDemo ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm";
            const btnAction = isDemo 
                ? `onclick="alert('Este é um perfil demonstrativo para ilustrar os serviços da plataforma.')"` 
                : `onclick="abrirSolicitacao('${doc.id}', '${data.nome_profissional}', ${servico.price})"`;

            container.innerHTML += `
                <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between ${opacityClass} animate-fadeIn">
                    <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <img src="${data.foto_perfil || 'https://ui-avatars.com/api/?background=random'}" class="w-8 h-8 rounded-full object-cover border border-gray-100">
                            <div>
                                <h4 class="font-bold text-xs text-gray-800 line-clamp-1">${data.nome_profissional}</h4>
                                <div class="flex items-center gap-1">${badgeDemo}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <p class="text-[10px] text-gray-500 uppercase font-bold">${servico.category}</p>
                        <p class="text-xs font-black text-blue-900">R$ ${servico.price},00 <span class="text-[8px] font-normal text-gray-400">/estimado</span></p>
                    </div>

                    <button ${btnAction} class="w-full ${btnColor} py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition">
                        ${btnText}
                    </button>
                </div>
            `;
        });

    } catch (e) {
        console.error("Erro ao carregar (Provável falta de índice):", e);
        // Link para o console se der erro
        if(e.message.includes("index")) {
            console.log("⚠️ CLIQUE NO LINK ACIMA NO CONSOLE PARA CRIAR O ÍNDICE NO FIREBASE");
        }
        container.innerHTML = `<div class="col-span-2 text-center text-red-400 text-xs">Erro de conexão. Verifique o console.</div>`;
    }
}

// Inicializa se a aba estiver visível
if(document.getElementById('sec-servicos') && !document.getElementById('sec-servicos').classList.contains('hidden')){
    carregarCatalogoServicos();
}
