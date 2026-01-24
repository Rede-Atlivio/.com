import { db } from '../app.js';
import { userProfile } from '../auth.js';
import { collection, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let listenerOportunidadesAtivo = false;

// GATILHO DE CLIQUE NA ABA
const tabOportunidades = document.getElementById('tab-oportunidades');
if(tabOportunidades) {
    tabOportunidades.addEventListener('click', () => {
        carregarOportunidades();
    });
}

// INICIALIZAÇÃO
setTimeout(() => {
    carregarOportunidades();
}, 1500);

export function carregarOportunidades() {
    const container = document.getElementById('lista-oportunidades');
    if(!container) return;

    if(container.innerHTML.trim() === "") {
        container.innerHTML = `
            <div class="text-center py-10 animate-fadeIn">
                <div class="loader mx-auto mb-2 border-yellow-200 border-t-yellow-600"></div>
                <p class="text-xs font-bold text-yellow-600 uppercase">Carregando Oportunidades...</p>
                <p class="text-[9px] text-gray-400">Buscando vantagens para você.</p>
            </div>
        `;
    }

    if(listenerOportunidadesAtivo) return;

    // --- CORREÇÃO DE SEGURANÇA (FIREBASE RULES COMPLIANCE) ---
    // Verifica se é PRO ou ADMIN para decidir qual query fazer
    const isPro = userProfile && (userProfile.role === 'admin' || userProfile.is_pro);
    let q;

    if (isPro) {
        // PRO: Pode ver todo o histórico
        q = query(collection(db, "oportunidades"), orderBy("created_at", "desc"));
    } else {
        // FREE: Só pode ler itens antigos (> 5 min)
        // Isso impede que o Firestore bloqueie a requisição por "Permissão Negada"
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        q = query(collection(db, "oportunidades"), 
                  where("created_at", "<", fiveMinAgo), 
                  orderBy("created_at", "desc"));
    }

    onSnapshot(q, (snap) => {
        listenerOportunidadesAtivo = true;
        container.innerHTML = ""; 
        
        if(snap.empty) {
            container.innerHTML = `
                <div class="text-center py-10 text-gray-400 text-xs flex flex-col items-center">
                    <span class="text-4xl grayscale opacity-50 mb-2">⚡</span>
                    <p>Nenhuma oportunidade disponível.</p>
                    ${!isPro ? '<p class="text-[9px] mt-1 opacity-60">(Itens muito recentes são exclusivos PRO)</p>' : ''}
                </div>`;
        } else {
            snap.forEach(d => {
                const op = d.data();
                const isPremium = op.is_premium || false;
                const blurClass = (isPremium && !isPro) ? "blur-sm select-none pointer-events-none" : "";
                
                container.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between mb-2 animate-fadeIn relative overflow-hidden">
                        ${isPremium ? '<div class="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[8px] font-black px-2 py-1 rounded-bl-lg z-10">PRO</div>' : ''}
                        
                        <div class="flex-1 ${blurClass}">
                            <h4 class="font-black text-sm text-gray-800 uppercase italic leading-tight">${op.titulo}</h4>
                            <p class="text-[10px] text-gray-500 line-clamp-2">${op.descricao}</p>
                            ${(isPremium && !isPro) ? '<p class="text-[9px] text-red-500 font-bold mt-1">🔒 Exclusivo Membros PRO</p>' : ''}
                        </div>
                        
                        <div class="ml-3">
                            <a href="${(isPremium && !isPro) ? '#' : op.link}" target="${(isPremium && !isPro) ? '_self' : '_blank'}" class="bg-yellow-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md font-bold text-lg hover:bg-yellow-600 transition ${blurClass}">
                                ➔
                            </a>
                        </div>
                    </div>`;
            });
        }
    }, (error) => {
        console.error("Erro Oportunidades:", error);
        container.innerHTML = `<p class="text-red-500 text-xs text-center">Erro ao carregar. Tente recarregar a página.</p>`;
    });
}
