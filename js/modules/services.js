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
        // Busca prestadores online (Reais e Seeds)
        const q = query(collection(db, "active_providers"), where("is_online", "==", true), limit(20));
        const snapshot = await getDocs(q);

        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-xs">Nenhum prestador na região agora.</div>`;
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const servico = data.services && data.services.length > 0 ? data.services[0] : { category: "Geral", price: 0 };
            
            // --- LÓGICA DE PROTEÇÃO DE MARCA (SEED) ---
            const isSeed = data.is_seed === true;
            
            // Badge e Estilo
            const badgeDemo = isSeed 
                ? `<span class="bg-gray-100 text-gray-500 text-[8px] px-2 py-0.5 rounded border border-gray-200 uppercase tracking-wide">Demonstração</span>` 
                : `<span class="bg-green-100 text-green-700 text-[8px] px-2 py-0.5 rounded border border-green-200 uppercase tracking-wide">● Online</span>`;
            
            const opacityClass = isSeed ? "opacity-80 grayscale-[0.3]" : "";
            
            // Ação do Botão
            const btnText = isSeed ? "Como Funciona?" : "Solicitar";
            const btnColor = isSeed ? "bg-gray-600 hover:bg-gray-700" : "bg-blue-600 hover:bg-blue-700";
            const btnAction = isSeed 
                ? `onclick="alert('🚧 MODO DEMONSTRAÇÃO\\n\\nA Atlivio está em fase de expansão! Este perfil serve para mostrar como a plataforma funciona. Em breve, profissionais reais estarão disponíveis aqui.')"` 
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

                    <button ${btnAction} class="w-full ${btnColor} text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm transition">
                        ${btnText}
                    </button>
                </div>
            `;
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="col-span-2 text-center text-red-400 text-xs">Erro ao carregar.</div>`;
    }
}

// Inicializa se a aba estiver visível
if(document.getElementById('sec-servicos') && !document.getElementById('sec-servicos').classList.contains('hidden')){
    carregarCatalogoServicos();
}
