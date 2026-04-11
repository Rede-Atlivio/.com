import { db } from '../config.js';
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

            // 💡 PEÇA DE ENGENHARIA: Card Lapidado com foco em Conversão
            container.innerHTML += `
               <div class="bg-white p-4 rounded-2xl border-2 ${data.is_patrocinado ? 'border-blue-500 bg-blue-50/40 shadow-blue-100 ring-2 ring-blue-50' : (data.valor ? 'border-blue-200 bg-blue-50/10' : 'border-gray-100')} shadow-sm mb-3 animate-fadeIn relative transition-all">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 pr-3">
                            <div class="flex items-center mb-1.5">
                                <span class="${tipoClass} text-[7px] font-black px-2 py-1 rounded-full uppercase mr-1">${icon} ${data.tipo}</span>
                                ${badgeDemo}
                            </div>
                            
                            <h4 class="font-black text-slate-800 text-[11px] uppercase leading-tight tracking-tighter">${data.titulo}</h4>
                            <p class="text-[9px] text-gray-500 mt-1 leading-snug line-clamp-2">${data.descricao}</p>
                            
                            ${data.valor ? `
                                <div class="mt-2 flex items-center gap-1">
                                    <span class="text-[10px] font-black text-blue-600 uppercase italic">Vantagem: ${data.valor}</span>
                                </div>
                            ` : ''}
                        </div>

                        <div class="flex flex-col items-center">
                            <a href="${data.link || '#'}" target="_blank" 
                               class="bg-blue-600 text-white text-[9px] font-black px-4 py-3 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-all uppercase whitespace-nowrap">
                                RESGATAR AGORA 🚀
                            </a>
                        </div>
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
