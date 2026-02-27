import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-missoes'); // Ajuste o ID conforme seu index.html
    if (!container) return;

    // Estrutura Principal do Canal
    container.innerHTML = `
        <div class="p-4 animate-fade pb-24">
            <div class="mb-6">
                <h2 class="text-2xl font-black text-white italic uppercase tracking-tighter">📺 Canal ATLIVIO</h2>
                <p class="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Educação • Novidades • Lucro</p>
            </div>

            <div class="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-4">
                <button onclick="window.filtrarCanal('todos')" class="bg-white text-black px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap">🔥 Tudo</button>
                <button onclick="window.filtrarCanal('onboarding')" class="bg-slate-900 text-gray-400 border border-white/5 px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap">▶️ Comece Aqui</button>
                <button onclick="window.filtrarCanal('regras')" class="bg-slate-900 text-gray-400 border border-white/5 px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap">⚠️ Avisos</button>
                <button onclick="window.filtrarCanal('estrategia')" class="bg-slate-900 text-gray-400 border border-white/5 px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap">🧠 Estratégia</button>
            </div>

            <div id="canal-content" class="grid grid-cols-1 gap-6">
                <div class="py-10 text-center"><div class="loader border-t-emerald-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></div>
            </div>
        </div>
    `;

    loadCanalPosts();
}

async function loadCanalPosts(filtro = 'todos') {
    const grid = document.getElementById('canal-content');
    const db = window.db;
    
    try {
        const q = query(collection(db, "tutorials"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            grid.innerHTML = `<p class="text-center text-gray-500 py-10">O Canal está sendo atualizado. Volte em breve!</p>`;
            return;
        }

        grid.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            
            // Lógica de Categorização (Baseada no título ou tag)
            let categoriaTag = data.category || "Novidades";
            let corTag = "text-blue-400";
            
            if(data.title.toLowerCase().includes("comece") || data.title.toLowerCase().includes("usar")) {
                categoriaTag = "Onboarding";
                corTag = "text-emerald-400";
            } else if(data.title.toLowerCase().includes("aviso") || data.title.toLowerCase().includes("regra")) {
                categoriaTag = "Importante";
                corTag = "text-red-400";
            }

            grid.innerHTML += `
                <div class="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl animate-fade">
                    <div class="relative pt-[56.25%] bg-black">
                        <iframe class="absolute inset-0 w-full h-full" src="${data.url}" frameborder="0" allowfullscreen></iframe>
                    </div>
                    <div class="p-5">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[9px] font-black ${corTag} uppercase tracking-widest">${categoriaTag}</span>
                            <span class="text-[8px] text-gray-600 font-mono">${new Date(data.created_at?.toDate()).toLocaleDateString()}</span>
                        </div>
                        <h3 class="font-black text-white text-lg leading-tight uppercase italic mb-3">${data.title}</h3>
                        
                        <div class="pt-4 border-t border-white/5">
                            <button onclick="window.switchTab('missoes')" class="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition">
                                Aplicar Conhecimento Agora ➔
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

    } catch (e) {
        console.error("Erro Canal:", e);
        grid.innerHTML = `<p class="text-red-500 text-center">Erro ao carregar o canal.</p>`;
    }
}

window.filtrarCanal = (cat) => {
    // Implementação futura de filtro refinado
    loadCanalPosts(cat);
};
