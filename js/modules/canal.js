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
    const uid = window.auth.currentUser.uid;
    
    try {
        const [snap, userSnap] = await Promise.all([
            getDocs(query(collection(db, "canal_atlivio"), orderBy("created_at", "desc"))),
            getDoc(doc(db, "usuarios", uid))
        ]);
        
        const resgatados = userSnap.data()?.resgates_canal || [];
        if (snap.empty) { grid.innerHTML = `<p class="text-center text-gray-500 py-10">Atualizando portal...</p>`; return; }

        grid.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            if (filtro !== 'todos' && data.category !== filtro && !(filtro === 'ads' && data.is_ads)) return;

            const jaResgatouCard = resgatados.includes(d.id);
            const isAdsCard = data.is_ads === true;

            grid.innerHTML += `
                <div class="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
                    <div class="relative pt-[56.25%] bg-black">
                        <!-- Vídeo Limpo para o YouTube funcionar de primeira -->
                        <iframe id="video-${d.id}" class="absolute inset-0 w-full h-full" 
                            src="${data.url}?rel=0" frameborder="0" allow="autoplay; encrypted-media"></iframe>
                    </div>
                    <div class="p-5">
                        <h3 class="font-black text-white text-md leading-tight uppercase italic mb-3">${data.title}</h3>
                        
                        ${isAdsCard ? `
                            <div id="area-verify-${d.id}" class="mb-2">
                                ${jaResgatouCard ? 
                                    `<div class="w-full bg-slate-800/50 text-gray-500 py-3 rounded-2xl text-[10px] font-black uppercase text-center opacity-50">✅ RECOMPENSA RESGATADA</div>` : 
                                    `<button onclick="window.iniciarValidacaoHibrida('${d.id}', ${data.recompensa_atlix}, ${data.duracao_segundos || 10})" 
                                        id="btn-resgate-${d.id}" class="w-full bg-slate-800 text-emerald-500 border border-emerald-500/20 py-3 rounded-2xl text-[10px] font-black uppercase">
                                        🛡️ VALIDAR ASSISTÊNCIA (GANHAR ATLIX)
                                    </button>`
                                }
                            </div>
                        ` : ''}

                        <button onclick="window.registrarCliqueObjetivo('${d.id}', '${data.target_aba || 'home'}')" 
                            class="w-full bg-white/5 hover:bg-white/10 text-white py-2 rounded-xl text-[9px] font-black uppercase transition border border-white/5">
                            ${data.button_text || 'Ver Agora ➔'}
                        </button>
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
}

// 🛡️ MOTOR DE VALIDAÇÃO: Monitora se o usuário está com o app aberto
window.iniciarValidacaoHibrida = (videoId, valor, tempoNecessario) => {
    const btn = document.getElementById(`btn-resgate-${videoId}`);
    if (!btn) return;

    let segundosRestantes = tempoNecessario;
    btn.disabled = true; // Trava para evitar cliques múltiplos
    btn.className = "w-full bg-slate-700 text-yellow-500 py-3 rounded-2xl text-[10px] font-black uppercase transition-all";

    const verificador = setInterval(() => {
        // 🚨 SÓ CONTA SE O USUÁRIO ESTIVER VENDO A PÁGINA
        if (document.visibilityState === 'visible') {
            segundosRestantes--;
            btn.innerText = `⏳ VALIDANDO PRESENÇA: ${segundosRestantes}S`;
            
            if (segundosRestantes <= 0) {
                clearInterval(verificador);
                btn.innerHTML = `🎁 RESGATAR +${valor} ATLIX AGORA!`;
                btn.className = "w-full bg-emerald-500 text-white py-3 rounded-2xl text-[10px] font-black uppercase animate-bounce cursor-pointer";
                btn.disabled = false;
                btn.onclick = () => window.resgatarRecompensaCanal(videoId, valor);
            }
        } else {
            btn.innerText = `⚠️ VALIDAÇÃO PAUSADA (VOLTE AO APP)`;
        }
    }, 1000);
};

window.filtrarCanal = (cat) => {
    loadCanalPosts(cat);
};
