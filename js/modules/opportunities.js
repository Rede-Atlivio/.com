import { db } from '../app.js';
import { collection, query, orderBy, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function carregarOportunidades() {
    const container = document.getElementById('lista-oportunidades');
    if (!container) return;

    container.innerHTML = `<div class="loader mx-auto border-blue-200 border-t-blue-600"></div>`;

    try {
        // --- AQUI ESTAVA O ERRO: Mudado de "opportunities" para "oportunidades" ---
        const q = query(collection(db, "oportunidades"), orderBy("created_at", "desc"), limit(20));
        const querySnapshot = await getDocs(q);

        container.innerHTML = "";
        
        if (querySnapshot.empty) {
            container.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Nenhuma oportunidade hoje.</p>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const isDemo = data.is_demo === true;
            
            // Cores e Ícones
            let tipoClass = "bg-blue-100 text-blue-700";
            let icon = "⚡";
            if (data.tipo === 'cashback') { tipoClass = "bg-green-100 text-green-700"; icon = "💰"; }
            if (data.tipo === 'alerta') { tipoClass = "bg-red-100 text-red-700"; icon = "🔔"; }

            // Lógica do Badge (Etiqueta no topo)
            let badgeDemo = "";
            // Lógica da Linha Discreta (Rodapé)
            let footerDemo = "";

            if (isDemo) {
                badgeDemo = `<span class="ml-2 bg-gray-200 text-gray-500 text-[8px] px-2 py-0.5 rounded border border-gray-300 uppercase tracking-wide">Exemplo</span>`;
                
                // Frase discreta no rodapé
                footerDemo = `
                    <div class="mt-3 pt-2 border-t border-gray-100 text-center">
                        <p class="text-[8px] text-gray-400 italic">
                            Conteúdo demonstrativo para ilustrar o funcionamento da plataforma.
                        </p>
                    </div>
                `;
            }

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 animate-fadeIn">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 pr-2">
                            <div class="flex items-center mb-1">
                                <span class="${tipoClass} text-[8px] font-bold px-2 py-1 rounded uppercase mr-1">${icon} ${data.tipo}</span>
                                ${badgeDemo}
                            </div>
                            <h4 class="font-black text-blue-900 text-xs uppercase leading-tight">${data.titulo}</h4>
                            <p class="text-[10px] text-gray-500 mt-1 line-clamp-2">${data.descricao}</p>
                        </div>
                        <a href="${data.link || '#'}" target="_blank" class="bg-slate-800 text-white text-[9px] font-bold px-4 py-2 rounded-lg hover:bg-slate-900 shadow-md whitespace-nowrap self-center">
                            VER OFERTA
                        </a>
                    </div>
                    ${footerDemo}
                </div>
            `;
        });

    } catch (e) {
        console.error("Erro oportunidades:", e);
        container.innerHTML = `<p class="text-center text-red-400 text-xs">Erro ao carregar.</p>`;
    }
}

// Inicialização
if(document.getElementById('sec-oportunidades') && !document.getElementById('sec-oportunidades').classList.contains('hidden')){
    carregarOportunidades();
}
window.carregarOportunidades = carregarOportunidades;
const tabBtn = document.getElementById('tab-oportunidades');
if(tabBtn) tabBtn.addEventListener('click', carregarOportunidades);
