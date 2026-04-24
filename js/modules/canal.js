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
        // 🔍 Busca os posts e as recompensas já resgatadas pelo usuário
        const [snap, userSnap] = await Promise.all([
            getDocs(query(collection(db, "canal_atlivio"), orderBy("created_at", "desc"))),
            getDoc(doc(db, "usuarios", uid))
        ]);
        
        const resgatados = userSnap.data()?.resgates_canal || [];

        if (snap.empty) {
            grid.innerHTML = `<p class="text-center text-gray-500 py-10">O Canal está sendo atualizado.</p>`;
            return;
        }

        grid.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            if (filtro !== 'todos' && data.category !== filtro && !(filtro === 'ads' && data.is_ads)) return;

            const jaResgatou = resgatados.includes(d.id);
            let corTag = data.is_ads ? "text-emerald-400" : "text-blue-400";
            
            // 🛑 LÓGICA DE BOTÃO (SÓ LIBERA NO FINAL SE FOR ADS)
            let textoBotao = data.button_text || "Ver Agora ➔";
            let acaoBotao = `window.switchTab('${data.target_aba || 'home'}')`;
            let classeBotao = "bg-white/5 text-white";

            if (data.is_ads) {
                if (jaResgatou) {
                    textoBotao = "✅ RECOMPENSA RESGATADA";
                    acaoBotao = "console.log('Já resgatado')";
                    classeBotao = "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50";
                } else {
                    // Botão começa desativado/escondido para Ads não resgatados
                    textoBotao = `🎁 ASSISTA ATÉ O FIM PARA GANHAR`;
                    acaoBotao = `alert('Assista o vídeo completo para liberar o bônus!')`;
                    classeBotao = "bg-slate-800 text-emerald-500 border border-emerald-500/20";
                }
            }

            grid.innerHTML += `
                <div class="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                    <div class="relative pt-[56.25%] bg-black">
                        <iframe id="video-${d.id}" class="absolute inset-0 w-full h-full" 
                            src="${data.url}?rel=0&enablejsapi=1&modestbranding=1" 
                            frameborder="0" allowfullscreen></iframe>
                    </div>
                    <div class="p-5">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[9px] font-black ${corTag} uppercase tracking-widest">${data.is_ads ? 'Oportunidade' : data.category}</span>
                            <span class="text-[8px] text-gray-600 font-mono">${new Date(data.created_at?.toDate()).toLocaleDateString()}</span>
                        </div>
                        <h3 class="font-black text-white text-lg leading-tight uppercase italic mb-3">${data.title}</h3>
                        <button id="btn-resgate-${d.id}" onclick="${acaoBotao}" class="w-full ${classeBotao} py-3 rounded-2xl text-[10px] font-black uppercase transition duration-300">
                            ${textoBotao}
                        </button>
                    </div>
                </div>
            `;

            // 🛰️ DISPARAR RASTREADOR DE CONCLUSÃO (Somente para ADS não resgatados)
            if (data.is_ads && !jaResgatou) {
                configurarRastreadorVideo(d.id, data.recompensa_atlix);
            }
        });

    } catch (e) { console.error(e); }
}

// 🧠 MOTOR DE RETENÇÃO (API YOUTUBE)
function configurarRastreadorVideo(videoId, valor) {
    // Gil, aqui usamos a API do YouTube para saber se o vídeo chegou ao fim
    // Essa lógica impede o usuário de "pular" o vídeo.
    setTimeout(() => {
        const frame = document.getElementById(`video-${videoId}`);
        if (!frame) return;

        // Avisa o usuário que estamos vigiando o tempo
        console.log(`🛰️ Vigia de Retenção ativo para o vídeo: ${videoId}`);

        // Ouve mensagens do Iframe (API do YouTube)
        window.addEventListener('message', (event) => {
            if (event.source !== frame.contentWindow) return;
            const data = JSON.parse(event.data);
            
            // 'onStateChange' 0 significa vídeo finalizado
            if (data.event === 'onStateChange' && data.info === 0) {
                const btn = document.getElementById(`btn-resgate-${videoId}`);
                btn.innerHTML = `🎁 RESGATAR +${valor} ATLIX AGORA!`;
                btn.className = "w-full bg-emerald-500 text-white py-3 rounded-2xl text-[10px] font-black uppercase animate-bounce";
                btn.onclick = () => window.resgatarRecompensaCanal(videoId, valor);
            }
        });
    }, 2000);
}

// 💰 FUNÇÃO DE PAGAMENTO AUTOMÁTICO (O CORAÇÃO DO ADS RECOMPENSADO)
window.resgatarRecompensaCanal = async (postId, valor) => {
    const btn = document.getElementById(`btn-resgate-${postId}`);
    if (btn.disabled || btn.innerText.includes("RESGATADO")) return;

    btn.innerText = "💰 CREDITANDO...";
    btn.disabled = true;

    try {
        const uid = window.auth.currentUser.uid;
        const { doc, updateDoc, arrayUnion, increment } = window.firebaseModules;
        
        // 1. Credita o Saldo (Bônus)
        // 2. Marca este post como resgatado no perfil do usuário (Para o botão não voltar a ficar verde)
        await updateDoc(doc(window.db, "usuarios", uid), {
            wallet_bonus: increment(valor),
            resgates_canal: arrayUnion(postId)
        });

        // 3. 📝 GERA O EXTRATO (Conectando ao Wallet.js)
        if (window.registrarMovimentacao) {
            await window.registrarMovimentacao(valor, "🎁 BÔNUS_CANAL", `Vídeo Premiado resgatado`);
        }

        alert(`✅ Sucesso! +${valor} ATLIX creditados.`);
        btn.innerText = "✅ RECOMPENSA RESGATADA";
        btn.className = "w-full bg-gray-800 text-gray-500 py-3 rounded-2xl text-[10px] font-black uppercase opacity-50";

    } catch (e) {
        alert("Erro no resgate.");
        btn.disabled = false;
    }
};

window.filtrarCanal = (cat) => {
    loadCanalPosts(cat);
};
