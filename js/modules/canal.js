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

            const jaResgatou = resgatados.includes(d.id);
            
            let textoBotao = data.button_text || "Ver Agora ➔";
            let acaoBotao = `window.registrarCliqueObjetivo('${d.id}', '${data.target_aba || 'home'}')`;
            let classeBotao = "bg-white/5 text-white";

            if (data.is_ads) {
                if (jaResgatou) {
                    textoBotao = "✅ RECOMPENSA RESGATADA";
                    acaoBotao = "console.log('Já resgatado')";
                    classeBotao = "bg-gray-800 text-gray-500 opacity-50";
                } else {
                    textoBotao = `🔒 ASSISTA TUDO PARA GANHAR`;
                    acaoBotao = `alert('O bônus será liberado automaticamente ao fim do vídeo!')`;
                    classeBotao = "bg-slate-800 text-emerald-500 border border-emerald-500/20 cursor-not-allowed";
                }
            }

            grid.innerHTML += `
                <div class="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                    <div class="relative pt-[56.25%] bg-black">
                        <iframe id="video-${d.id}" class="absolute inset-0 w-full h-full" 
                            src="${data.url}?rel=0&enablejsapi=1&modestbranding=1&controls=0&disablekb=1" 
                            frameborder="0" allow="autoplay; encrypted-media"></iframe>
                        <div class="absolute bottom-0 left-0 w-full h-12 z-10 cursor-not-allowed"></div>
                    </div>
                    <div class="p-5">
                        <h3 class="font-black text-white text-lg leading-tight uppercase italic mb-3">${data.title}</h3>
                        <button id="btn-resgate-${d.id}" onclick="${acaoBotao}" class="w-full ${classeBotao} py-3 rounded-2xl text-[10px] font-black uppercase transition duration-300">
                            ${textoBotao}
                        </button>
                    </div>
                </div>
            `;

            if (data.is_ads && !jaResgatou) {
                // Pega o tempo do banco ou assume 10s se estiver vazio
                const tempo = data.duracao_segundos || 10;
                window.configurarRastreadorVideo(d.id, data.recompensa_atlix, tempo);
            }
        });
    } catch (e) { console.error(e); }
}

// 🧠 MOTOR DE RETENÇÃO (API YOUTUBE)
window.configurarRastreadorVideo = (videoId, valor, segundosNecessarios) => {
    const btn = document.getElementById(`btn-resgate-${videoId}`);
    if (!btn) return;

    let segundosContados = 0;
    // Gil, o bônus só libera após o tempo que VOCÊ definiu no Admin
    const cronometro = setInterval(() => {
        segundosContados++;
        
        // Atualiza o texto do botão para o usuário ver o progresso
        const falta = segundosNecessarios - segundosContados;
        if (falta > 0) {
            btn.innerText = `🔒 AGUARDE ${falta}s PARA LIBERAR`;
        } else {
            // LIBERAÇÃO TOTAL
            clearInterval(cronometro);
            btn.innerHTML = `🎁 RESGATAR +${valor} ATLIX AGORA!`;
            btn.className = "w-full bg-emerald-500 text-white py-3 rounded-2xl text-[10px] font-black uppercase animate-bounce shadow-[0_0_15px_rgba(16,185,129,0.5)] cursor-pointer";
            btn.onclick = () => window.resgatarRecompensaCanal(videoId, valor);
        }
    }, 1000);
}

// 💰 FUNÇÃO DE PAGAMENTO AUTOMÁTICO (V2026 - BLINDADA)
window.resgatarRecompensaCanal = async (postId, valor) => {
    const btn = document.getElementById(`btn-resgate-${postId}`);
    if (!btn || btn.disabled || btn.innerText.includes("RESGATADO")) return;

    btn.innerText = "💰 CREDITANDO...";
    btn.disabled = true;

    try {
        const uid = window.auth.currentUser.uid;
        const { doc, updateDoc, arrayUnion, increment } = window.firebaseModules;
        
        // 1. Credita o Saldo (Bônus) e marca como resgatado para nunca mais ganhar este post
        await updateDoc(doc(window.db, "usuarios", uid), {
            wallet_bonus: increment(valor),
            resgates_canal: arrayUnion(postId)
        });

        // 2. 🛰️ TELEMETRIA: Avisa ao banco que houve uma conclusão de ADS
        await updateDoc(doc(window.db, "canal_atlivio", postId), {
            visualizacoes_completas: increment(1)
        });

        // 3. 📝 EXTRATO: Registra a linha visual na carteira do usuário
        if (window.registrarMovimentacao) {
            await window.registrarMovimentacao(valor, "🎁 BÔNUS_CANAL", `Vídeo Premiado concluído`);
        }

        alert(`✅ Sucesso! +${valor} ATLIX creditados.`);
        
        // 4. MUTAÇÃO VISUAL FINAL (Impedir clique duplo)
        btn.innerText = "✅ RECOMPENSA RESGATADA";
        btn.onclick = null;
        btn.className = "w-full bg-gray-800 text-gray-500 py-3 rounded-2xl text-[10px] font-black uppercase opacity-50";

    } catch (e) {
        console.error("Erro no resgate:", e);
        alert("Erro ao processar recompensa.");
        btn.disabled = false;
        btn.innerText = "TENTAR NOVAMENTE";
    }
};

// 🛰️ TELEMETRIA INFORMATIVA: Conta cliques no botão de ação de vídeos comuns
window.registrarCliqueObjetivo = async (postId, abaDestino) => {
    try {
        const { doc, updateDoc, increment } = window.firebaseModules;
        // Incrementa o contador de cliques para o relatório do Admin
        await updateDoc(doc(window.db, "canal_atlivio", postId), {
            cliques_objetivo: increment(1)
        });
    } catch (e) { console.warn("Falha telemetria clique:", e); }
    
    // Executa a navegação original
    if (window.switchTab) window.switchTab(abaDestino);
};

window.filtrarCanal = (cat) => {
    loadCanalPosts(cat);
};
