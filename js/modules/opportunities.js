import { db } from '../app.js';
import { collection, query, orderBy, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function carregarOportunidades() {
    const container = document.getElementById('lista-oportunidades');
    if (!container) return;

    container.innerHTML = `<div class="loader mx-auto border-blue-200 border-t-blue-600"></div>`;

    try {
        const q = query(collection(db, "opportunities"), orderBy("created_at", "desc"), limit(20));
        const querySnapshot = await getDocs(q);

        container.innerHTML = "";
        
        if (querySnapshot.empty) {
            container.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Nenhuma oportunidade hoje.</p>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // LÓGICA VISUAL INTELIGENTE
            const isDemo = data.is_demo === true;
            
            // Define cores baseadas no tipo
            let tipoClass = "bg-blue-100 text-blue-700";
            let icon = "⚡";
            if (data.tipo === 'cashback') { tipoClass = "bg-green-100 text-green-700"; icon = "💰"; }
            if (data.tipo === 'alerta') { tipoClass = "bg-red-100 text-red-700"; icon = "🔔"; }

            // Badge de Demo (Automático)
            let badgeDemo = "";
            if (isDemo) {
                badgeDemo = `<span class="ml-2 bg-gray-200 text-gray-500 text-[8px] px-2 py-0.5 rounded border border-gray-300 uppercase tracking-wide">Exemplo</span>`;
            }

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between mb-3 animate-fadeIn">
                    <div class="flex-1 pr-2">
                        <div class="flex items-center mb-1">
                            <span class="${tipoClass} text-[8px] font-bold px-2 py-1 rounded uppercase mr-1">${icon} ${data.tipo}</span>
                            ${badgeDemo}
                        </div>
                        <h4 class="font-black text-blue-900 text-xs uppercase leading-tight">${data.titulo}</h4>
                        <p class="text-[10px] text-gray-500 mt-1 line-clamp-2">${data.descricao}</p>
                    </div>
                    <a href="${data.link || '#'}" target="_blank" class="bg-slate-800 text-white text-[9px] font-bold px-4 py-2 rounded-lg hover:bg-slate-900 shadow-md whitespace-nowrap">
                        VER OFERTA
                    </a>
                </div>
            `;
        });

    } catch (e) {
        console.error("Erro oportunidades:", e);
        container.innerHTML = `<p class="text-center text-red-400 text-xs">Erro ao carregar.</p>`;
    }
}

// Auto-inicialização segura
if(document.getElementById('sec-oportunidades') && !document.getElementById('sec-oportunidades').classList.contains('hidden')){
    carregarOportunidades();
}

// Expõe para o app.js chamar se necessário
window.carregarOportunidades = carregarOportunidades;

// Ouve o clique na aba
const tabBtn = document.getElementById('tab-oportunidades');
if(tabBtn) tabBtn.addEventListener('click', carregarOportunidades);
