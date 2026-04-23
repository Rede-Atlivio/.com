import { collection, getDocs, query, orderBy, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('sec-canal');
    if (!container) return;

    container.innerHTML = `
        <div class="p-4 animate-fade pb-24">
            <div class="mb-6">
                <h2 class="text-2xl font-black text-white italic uppercase tracking-tighter">📺 Canal ATLIVIO</h2>
                <p class="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Educação • Novidades • Lucro</p>
            </div>

            <div class="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-4">
                <button onclick="window.filtrarCanal('todos')" class="bg-white text-black px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap shadow-md">🔥 Tudo</button>
                <button onclick="window.filtrarCanal('comece_aqui')" class="bg-slate-900 text-gray-400 border border-white/5 px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap">▶️ Comece Aqui</button>
                <button onclick="window.filtrarCanal('avisos')" class="bg-slate-900 text-gray-400 border border-white/5 px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap">⚠️ Avisos</button>
                <button onclick="window.filtrarCanal('novidades')" class="bg-slate-900 text-gray-400 border border-white/5 px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap">🚀 Novidades</button>
                <button onclick="window.filtrarCanal('lucro')" class="bg-slate-900 text-gray-400 border border-white/5 px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap">🧠 Dicas de Lucro</button>
                <button onclick="window.filtrarCanal('ads')" class="bg-slate-900 text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap">🎁 Recompensas</button>
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
        // 🛰️ CONEXÃO OFICIAL: Busca na coleção exclusiva do cliente
        const q = query(collection(db, "canal_atlivio"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            grid.innerHTML = `<p class="text-center text-gray-500 py-10">O Canal está sendo atualizado. Volte em breve!</p>`;
            return;
        }

        grid.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            
            // Filtro simples (onboarding ou ads)
            if (filtro !== 'todos' && data.category !== filtro && !(filtro === 'ads' && data.is_ads)) return;

            // 🏷️ LÓGICA DE CATEGORIA E CORES
            let corTag = "text-blue-400";
            if (data.is_ads) corTag = "text-emerald-400";
            if (data.category === 'regras') corTag = "text-red-400";

           // 🎁 MOTOR DE AÇÃO E RECOMPENSA (PODER TOTAL DO ADMIN)
            let textoBotao = data.button_text || "Ver Agora ➔";
            let acaoBotao = `window.switchTab('${data.target_aba || 'home'}')`;
            let classeBotao = "bg-white/5 hover:bg-white/10 text-white";

            // Se for ADS, o botão de recompensa é PRIORIDADE sobre o switchTab
            if (data.is_ads === true) {
                textoBotao = `🎁 RESGATAR +${data.recompensa_atlix || 2} ATLIX`;
                acaoBotao = `window.resgatarRecompensaCanal('${d.id}', ${data.recompensa_atlix || 2})`;
                classeBotao = "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95";
            }

            grid.innerHTML += `
                <div class="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl animate-fade">
                    <div class="relative pt-[56.25%] bg-black">
                        <iframe class="absolute inset-0 w-full h-full" src="${data.url}" frameborder="0" allowfullscreen></iframe>
                    </div>
                    <div class="p-5">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[9px] font-black ${corTag} uppercase tracking-widest">${data.is_ads ? 'Oportunidade' : data.category}</span>
                            <span class="text-[8px] text-gray-600 font-mono">${new Date(data.created_at?.toDate()).toLocaleDateString()}</span>
                        </div>
                        <h3 class="font-black text-white text-lg leading-tight uppercase italic mb-3">${data.title}</h3>
                        
                        <div class="pt-4 border-t border-white/5">
                            <button id="btn-canal-${d.id}" onclick="${acaoBotao}" class="w-full ${classeBotao} py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition duration-300">
                                ${textoBotao}
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

// 💰 FUNÇÃO DE PAGAMENTO AUTOMÁTICO (O CORAÇÃO DO ADS RECOMPENSADO)
window.resgatarRecompensaCanal = async (postId, valor) => {
    const btn = document.getElementById(`btn-canal-${postId}`);
    if (btn.disabled) return;

    btn.innerText = "PROCESSANDO...";
    btn.disabled = true;

    try {
        // Gil, aqui usamos o motor financeiro oficial da Atlivio
        // Mas como é um GANHO, usamos uma lógica de depósito (crédito)
        const { doc, updateDoc, increment } = window.firebaseModules;
        const userRef = doc(window.db, "usuarios", window.auth.currentUser.uid);

        // 🛡️ Segurança: No futuro você pode checar se ele já resgatou este post específico
        await updateDoc(userRef, {
            wallet_balance: increment(valor)
        });

        alert(`✅ Parabéns! +${valor} ATLIX creditados na sua conta.`);
        btn.innerText = "RESGATADO COM SUCESSO!";
        btn.classList.replace('bg-emerald-500', 'bg-gray-800');
        
        // Atualiza a carteira se o usuário mudar de aba
        if (window.carregarCarteira) window.carregarCarteira();

    } catch (e) {
        alert("Erro ao resgatar recompensa.");
        btn.disabled = false;
        btn.innerText = `🎁 RESGATAR +${valor} ATLIX`;
    }
};

window.filtrarCanal = (cat) => {
    loadCanalPosts(cat);
};
