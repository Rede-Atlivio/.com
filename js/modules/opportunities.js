import { db } from '../app.js';
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export function carregarOportunidades() {
    const container = document.getElementById('lista-oportunidades');
    if (!container) return;

    container.innerHTML = `<div class="text-center py-6"><div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div><p class="text-[9px] text-gray-400">Buscando ofertas...</p></div>`;

    const q = query(collection(db, "oportunidades"), orderBy("visibility_score", "desc"));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        
        if (snap.empty) {
            container.innerHTML = `<div class="text-center py-10 bg-white rounded-xl border border-gray-100"><p class="text-xs font-bold text-gray-500">Nenhuma oportunidade agora.</p></div>`;
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            const isDemo = data.is_demo === true;
            
            // Tratamento de undefined (Safety First)
            const title = data.titulo || "Oportunidade";
            const desc = data.descricao || "Confira os detalhes desta oferta.";
            const cta = data.cta_text || "Ver Oferta";
            
            // Visual Rico
            let badgeHtml = "";
            let borderColor = "border-gray-100";
            
            if (data.tipo_visual === 'alerta') { 
                badgeHtml = `<span class="bg-red-100 text-red-600 text-[8px] px-2 py-0.5 rounded border border-red-200 uppercase font-bold">🔴 Alerta</span>`;
                borderColor = "border-red-100";
            } else if (data.tipo_visual === 'cashback') {
                badgeHtml = `<span class="bg-green-100 text-green-600 text-[8px] px-2 py-0.5 rounded border border-green-200 uppercase font-bold">🟢 Cashback</span>`;
                borderColor = "border-green-100";
            } else if (data.tipo_visual === 'indique') {
                badgeHtml = `<span class="bg-blue-100 text-blue-600 text-[8px] px-2 py-0.5 rounded border border-blue-200 uppercase font-bold">🔵 Indicação</span>`;
            } else if (isDemo) {
                badgeHtml = `<span class="bg-gray-100 text-gray-500 text-[8px] px-2 py-0.5 rounded border border-gray-200 uppercase">Exemplo</span>`;
            }

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border ${borderColor} shadow-sm mb-3 animate-fadeIn flex justify-between items-center">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            ${badgeHtml}
                        </div>
                        <h3 class="font-black text-xs text-gray-800 uppercase line-clamp-1">${title}</h3>
                        <p class="text-[10px] text-gray-500 line-clamp-1">${desc}</p>
                    </div>
                    <button onclick="alert('ℹ️ DETALHES DA OFERTA\\n\\n${desc}')" class="ml-3 bg-slate-800 text-white px-4 py-2 rounded-lg text-[9px] font-bold uppercase shadow hover:bg-slate-900 transition whitespace-nowrap">
                        ${cta}
                    </button>
                </div>
            `;
        });
    });
}

// Inicializa
const tabOpps = document.getElementById('tab-oportunidades');
if(tabOpps) tabOpps.addEventListener('click', carregarOportunidades);
