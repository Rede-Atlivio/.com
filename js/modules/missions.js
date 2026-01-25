import { db } from '../app.js';
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export function carregarMissoes() {
    const container = document.getElementById('lista-missoes');
    if(!container) return;

    container.innerHTML = `<div class="text-center py-6"><div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div></div>`;

    const q = query(collection(db, "missoes"), orderBy("visibility_score", "desc"));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if (snap.empty) { container.innerHTML = `<div class="text-center text-gray-400 text-xs">Sem missões na área.</div>`; return; }

        snap.forEach(d => {
            const m = d.data();
            const isDemo = m.is_demo === true;
            
            // Lógica Visual de Status
            let statusBadge = "";
            let btnState = "";
            let opacity = "";

            if (m.status === 'concluida' || m.titulo.includes("(Concluída)")) {
                statusBadge = `<span class="text-green-600 font-bold text-[9px] bg-green-50 px-2 py-1 rounded border border-green-100">✅ Concluída</span>`;
                btnState = "disabled class='bg-gray-200 text-gray-400 px-4 py-2 rounded-lg text-[9px] font-bold uppercase cursor-not-allowed'";
                opacity = "opacity-75";
            } else if (m.titulo.includes("(Coletando)")) {
                statusBadge = `<span class="text-blue-600 font-bold text-[9px] bg-blue-50 px-2 py-1 rounded border border-blue-100">📸 Coletando</span>`;
                btnState = "onclick='alert(\"Missão em andamento por outro agente.\")' class='bg-blue-600 text-white px-4 py-2 rounded-lg text-[9px] font-bold uppercase'";
            } else if (m.titulo.includes("(Esgotada)")) {
                statusBadge = `<span class="text-red-600 font-bold text-[9px] bg-red-50 px-2 py-1 rounded border border-red-100">🔒 Esgotada</span>`;
                btnState = "disabled class='bg-gray-200 text-gray-400 px-4 py-2 rounded-lg text-[9px] font-bold uppercase'";
                opacity = "opacity-60";
            } else {
                // Padrão (Demo segura)
                statusBadge = `<span class="text-gray-500 font-bold text-[9px] bg-gray-100 px-2 py-1 rounded">👁️ Exemplo</span>`;
                btnState = "onclick='alert(\"Modo Demonstração: Esta missão serve para ilustrar o formato de ganho.\")' class='bg-gray-700 text-white px-4 py-2 rounded-lg text-[9px] font-bold uppercase'";
            }

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm animate-fadeIn flex justify-between items-center ${opacity}">
                    <div>
                        <div class="mb-1">${statusBadge}</div>
                        <h3 class="font-black text-xs text-gray-800 uppercase">${m.titulo}</h3>
                        <p class="text-[10px] text-green-600 font-bold">Recompensa: R$ ${m.valor || '0,00'}</p>
                    </div>
                    <button ${btnState}>Ver</button>
                </div>
            `;
        });
    });
}

const tabMissions = document.getElementById('tab-missoes');
if(tabMissions) tabMissions.addEventListener('click', carregarMissoes);
