import { db } from '../app.js';
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function carregarOportunidades() {
    const container = document.getElementById('lista-oportunidades');
    if(!container) return;
    
    container.innerHTML = "";
    const q = query(collection(db, "oportunidades"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    
    if(snap.empty) { 
        container.innerHTML = `<div class="text-center py-10 text-gray-400"><p class="text-xs">Sem vantagens.</p></div>`; 
    } else {
        snap.forEach(d => {
            const op = d.data();
            const isPremium = op.tipo === 'bug'; 
            const blurClass = isPremium ? "blur-secret" : "";
            const lockMsg = isPremium ? `<div class="absolute inset-0 flex items-center justify-center bg-white/50 z-10"><span class="bg-yellow-100 text-yellow-800 text-[9px] font-bold px-2 py-1 rounded">🔒 SÓ PRO</span></div>` : "";
            
            container.innerHTML += `
                <div class="bg-white border border-gray-100 p-4 rounded-xl shadow-sm mb-2 relative overflow-hidden">
                    ${lockMsg}
                    <div class="${blurClass}">
                        <h3 class="font-black text-sm italic uppercase">⚡ ${op.titulo}</h3>
                        <p class="text-[10px] text-gray-600">${op.descricao}</p>
                    </div>
                </div>`;
        });
    }
}

// Auto-Load
setInterval(() => { if(!document.getElementById('sec-oportunidades').classList.contains('hidden')) carregarOportunidades(); }, 15000);
