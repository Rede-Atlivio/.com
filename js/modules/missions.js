import { db, auth } from '../config.js';
import { collection, getDocs, getDoc, doc, query, where, addDoc, updateDoc, increment, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const styleAtlas = document.createElement('style');
styleAtlas.innerHTML = `
    @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes slide-ticker { 0% { transform: translateY(100%); opacity: 0; } 10% { transform: translateY(0); opacity: 1; } 90% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-100%); opacity: 0; } }
    .globo-atlas-mini { animation: spin-slow 12s linear infinite; font-size: 14px; opacity: 0.8; }
    .ticker-item { animation: slide-ticker 4s infinite; }
    .card-mission { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .card-mission:active { scale: 0.98; opacity: 0.9; }
    .filter-active { background: #3b82f6 !important; color: white !important; shadow: 0 4px 12px rgba(59,130,246,0.4); }
`;
document.head.appendChild(styleAtlas);

// Memória de Filtro Local
window.filtroMissaoAtual = 'all';

// 🚀 INICIALIZADOR ÚNICO V2026
// Gil, esta função agora apenas prepara o terreno, as exportações ficam fixas no final do arquivo
export async function initMissions() {
    console.log("🌍 Atlas Vivo: Sincronizando radar geográfico...");
    const container = document.getElementById('lista-missoes');
    if (!container) return;

    await carregarMissoes(); // Chama o motor de carga principal
}

// 🏗️ MOTOR DE CARGA ATLAS VIVO V2026
// Gil, mudamos o nome para carregarMissoes para o app.js te encontrar e já pedimos o GPS
async function carregarMissoes() {
    const container = document.getElementById('lista-missoes');
    if (!container) return;

    // 📍 Captura GPS inicial se necessário
    if (!window.userLocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            window.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            carregarMissoes();
        }, (err) => { console.warn("GPS necessário para missões locais"); }, { enableHighAccuracy: true });
    }

    container.innerHTML = `<div class="py-20 text-center"><div class="loader mx-auto border-blue-500"></div></div>`;

    try {
        const q = query(collection(db, "missions"), where("active", "==", true), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        
        // 💰 BUSCA DE DADOS FINANCEIROS PARA O TOPO
        const totalPoderCompra = (window.userProfile?.wallet_balance || 0) + (window.userProfile?.wallet_bonus || 0);

        // 🏗️ MONTAGEM DO NOVO TOPO (UI V2026)
        let htmlTopo = `
            <div class="space-y-6 mb-8 animate-fadeIn">
                <div class="bg-slate-900 rounded-[2.5rem] p-6 border border-white/5 shadow-2xl relative overflow-hidden">
                    <div class="absolute top-4 right-6 globo-atlas-mini">🌍</div>
                    <p class="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Poder de Compra AX</p>
                    <h2 class="text-3xl font-black text-white italic tracking-tighter">${totalPoderCompra.toFixed(2)} <span class="text-blue-500 text-lg">AX</span></h2>
                    
                    <div class="mt-4 pt-3 border-t border-white/5 h-6 overflow-hidden">
                        <div id="mission-ticker" class="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                             <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                             <span class="ticker-item">Rede Atlas: 142 usuários online agora</span>
                        </div>
                    </div>
                </div>

                <div class="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button onclick="window.filtrarRadar('all')" id="f-all" class="filter-active px-5 py-2.5 rounded-2xl bg-slate-800 text-gray-400 text-[10px] font-black uppercase whitespace-nowrap transition-all border border-white/5">🎯 Tudo</button>
                    <button onclick="window.filtrarRadar('physical')" id="f-physical" class="px-5 py-2.5 rounded-2xl bg-slate-800 text-gray-400 text-[10px] font-black uppercase whitespace-nowrap transition-all border border-white/5">📍 No Local</button>
                    <button onclick="window.filtrarRadar('fast')" id="f-fast" class="px-5 py-2.5 rounded-2xl bg-slate-800 text-gray-400 text-[10px] font-black uppercase whitespace-nowrap transition-all border border-white/5">⚡ Rápidas</button>
                    <button onclick="window.filtrarRadar('growth')" id="f-growth" class="px-5 py-2.5 rounded-2xl bg-slate-800 text-gray-400 text-[10px] font-black uppercase whitespace-nowrap transition-all border border-white/5">🎁 Bônus</button>
                </div>
            </div>
        `;

        if (snap.empty) {
            container.innerHTML = htmlTopo + `<p class="text-center text-gray-500 text-xs py-10 italic uppercase font-black opacity-30">Céu limpo no seu radar.</p>`;
            return;
        }

        let cardsHtml = "";
        const missoesOrdenadas = [];

        snap.forEach(doc => {
            const m = doc.data();
            m.id = doc.id;
            
            // Cálculo de distância para ordenação e exibição
            if (m.latitude && m.longitude && window.userLocation) {
                m.distancia = calcularDistancia(window.userLocation.lat, window.userLocation.lng, m.latitude, m.longitude) * 1000;
            } else {
                m.distancia = 999999; // Missões online vão pro final
            }
            missoesOrdenadas.push(m);
        });

        // Ordena por proximidade
        missoesOrdenadas.sort((a, b) => a.distancia - b.distancia);

        missoesOrdenadas.forEach(m => {
            // Filtro Lógico
            if (window.filtroMissaoAtual !== 'all' && m.category !== window.filtroMissaoAtual) return;

            // Diferenciação de DNA (B2B vs Atlivio)
            const isAdmin = m.owner_id === 'atlivio_master' || m.pay_type === 'bonus';
            const corTema = isAdmin ? 'text-purple-400' : 'text-emerald-400';
            const bgBadge = isAdmin ? 'bg-purple-500/10' : 'bg-emerald-500/10';
            const moedaLabel = isAdmin ? 'BÔNUS' : 'CRÉDITO';
            
            const distLabel = m.distancia < 50000 ? `📍 a ${m.distancia < 1000 ? Math.round(m.distancia) + 'm' : (m.distancia/1000).toFixed(1) + 'km'}` : '🌍 Online';

            cardsHtml += `
                <div class="card-mission bg-slate-900 border border-white/5 p-5 rounded-[2rem] mb-4 shadow-xl relative overflow-hidden">
                    <div class="flex justify-between items-start mb-4">
                        <div class="${bgBadge} px-3 py-1 rounded-full border border-white/5">
                            <p class="text-[7px] font-black ${corTema} uppercase tracking-widest">${moedaLabel} ATLIX</p>
                        </div>
                        <div class="text-right">
                            <h3 class="text-xl font-black text-white leading-none">${m.reward.toFixed(2)} AX</h3>
                            <p class="text-[8px] font-bold text-gray-500 mt-1 uppercase">${distLabel}</p>
                        </div>
                    </div>

                    <div class="space-y-1 mb-4">
                        <h4 class="text-sm font-black text-white uppercase tracking-tighter">${m.title}</h4>
                        <p class="text-[10px] text-gray-500 leading-tight line-clamp-2">${m.description}</p>
                    </div>

                    <div class="flex items-center gap-3">
                        <div class="flex-1 bg-black/40 rounded-2xl px-4 py-3 border border-white/5">
                            <div class="flex items-center gap-2">
                                <span class="w-1.5 h-1.5 rounded-full ${m.slots_disponiveis > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}"></span>
                                <p class="text-[9px] font-black text-gray-400 uppercase">${m.slots_disponiveis} Vagas</p>
                            </div>
                        </div>
                        <button onclick="window.abrirProvaMissao('${m.id}', '${m.title}', ${m.reward}, '${m.pay_type}', '${m.owner_id}', ${JSON.stringify(m.questions || []).replace(/"/g, '&quot;')})" 
                                class="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-900/20">
                            Iniciar Missão ➜
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = htmlTopo + cardsHtml;
        window.iniciarRotativoSocial(); // Ativa o ticker animado

    } catch (e) {
        console.error(e);
        container.innerHTML = `<p class="text-center text-red-500 text-[10px] py-10">Radar Offline. Tente recarregar.</p>`;
    }
}

// 🛰️ Lógica de Filtro Rápido
window.filtrarRadar = (cat) => {
    window.filtroMissaoAtual = cat;
    carregarMissoes();
};

// 🎭 Ticker de Prova Social Inteligente
window.iniciarRotativoSocial = () => {
    const msgs = [
        "Felipe de Feira acabou de ganhar 5.00 AX",
        "32 pessoas estão verificando fachadas agora",
        "Rede Atlas: +R$ 12.400 distribuídos este mês",
        "Nova missão disponível a 200m de você",
        "Seu Nível: Iniciante (Complete 3 missões para subir)"
    ];
    let i = 0;
    const el = document.getElementById('mission-ticker');
    if(!el) return;
    setInterval(() => {
        i = (i + 1) % msgs.length;
        el.innerHTML = `<span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> <span class="ticker-item">${msgs[i]}</span>`;
    }, 4000);
};

// 📽️ MOTOR DE VÍDEO VEO 3: Experiência Ultra-Limpa (Sem poluição de canais)
function verTutorialMissao(videoId) {
    if (!videoId) return;
    
    const modal = document.getElementById('modal-video-maestro');
    const frame = document.getElementById('player-maestro-frame');
    
    if (modal && frame) {
        // Usamos o domínio nocookie para reduzir a carga de scripts do YouTube
       // Gil, forçamos o controls=0 para ele não ter onde pendurar a barra de "Mais Vídeos"
        // E usamos o loop para ele não parar e mostrar lixo no final
        const cleanUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&controls=0&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&widget_referrer=${encodeURIComponent(window.location.origin)}&origin=${window.location.origin}`;
        
        frame.src = cleanUrl;
        modal.classList.remove('hidden');
        modal.style.setProperty('display', 'flex', 'important');
    } else {
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    }
}

// 📸 MOTOR DE EXECUÇÃO V2026: Escassez e Reserva Temporária
async function abrirProvaMissao(id, titulo, recompensa, tipoPagamento, b2bOwnerId, perguntas = []) {
    const { collection, getDocs, query, where, doc, runTransaction, increment } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    
    // Captura o botão específico pelo ID da missão para garantir que o feedback visual funcione
const btn = document.querySelector(`button[onclick*="${id}"]`);
    if(!btn) return;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "🔍 RESERVANDO...";

    try {
        const missionRef = doc(window.db, "missions", id);
        
        await runTransaction(window.db, async (transaction) => {
            const mSnap = await transaction.get(missionRef);
            const m = mSnap.data();
            if (m.slots_disponiveis <= 0) throw "Missão esgotada!";
            
            // Verifica se o usuário já enviou esta missão
            const qCheck = query(collection(window.db, "mission_submissions"), where("user_id", "==", auth.currentUser.uid), where("mission_id", "==", id));
            const sCheck = await getDocs(qCheck);
            if (!sCheck.empty) throw "Você já realizou esta missão!";

            transaction.update(missionRef, {
                slots_disponiveis: increment(-1),
                pessoas_realizando: increment(1)
            });
        });

        localStorage.setItem(`fazendo_${id}`, "true");
        window.iniciarCronometroDesistencia(id);

        if (!confirm(`🚀 Iniciar Missão: ${titulo}?\n\nO sistema abrirá a câmera para a prova oficial.`)) {
            btn.disabled = false; btn.innerText = originalText; return;
        }

        const inputCamera = document.getElementById('camera-input');
        inputCamera.value = "";
        
        // Pega localização no momento da foto
        navigator.geolocation.getCurrentPosition((pos) => {
            window.currentMissionLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }, null, { enableHighAccuracy: true });

        inputCamera.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) { btn.disabled = false; btn.innerText = originalText; return; }
            
            // 📝 Se houver perguntas, abre o Modal de Checklist antes de enviar
            if (perguntas && perguntas.length > 0) {
                window.abrirModalChecklist(perguntas, async (respostas) => {
                    await processarEnvioMissao(id, titulo, recompensa, tipoPagamento, file, b2bOwnerId, respostas);
                });
            } else {
                await processarEnvioMissao(id, titulo, recompensa, tipoPagamento, file, b2bOwnerId, {});
            }
        };

        inputCamera.setAttribute('data-owner', b2bOwnerId);
        inputCamera.click();
        
    } catch (err) {
        alert(err);
        btn.disabled = false; btn.innerText = originalText;
    }
}
// 📦 MOTOR DE COMPRESSÃO E UPLOAD V2026 (MAESTRO)
async function processarEnvioMissao(id, titulo, recompensa, tipoPagamento, arquivo, b2bOwnerId, respostas = {}) {
    const btn = document.querySelector(`button[onclick*="${id}"]`);
    
    try {
        if(btn) btn.innerText = "⏳ PROCESSANDO...";

        // 📸 Compressão Inteligente (Mantendo sua lógica de 1200px)
        const bitmap = await createImageBitmap(arquivo);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 1200 / Math.max(bitmap.width, bitmap.height);
        canvas.width = bitmap.width * scale;
        canvas.height = bitmap.height * scale;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.8));

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64data = reader.result;

            // 📏 Cálculo de Distância Real para Auditoria
            let distanciaFinal = 0;
            const mSnap = await getDoc(doc(db, "missions", id));
            if (mSnap.exists() && window.currentMissionLocation) {
                const mData = mSnap.data();
                distanciaFinal = calcularDistancia(window.currentMissionLocation.lat, window.currentMissionLocation.lng, mData.latitude, mData.longitude) * 1000;
            }

            // 🚀 REGISTRO DA SUBMISSÃO PRO
            await addDoc(collection(db, "mission_submissions"), {
                mission_id: id,
                b2b_owner_uid: b2bOwnerId,
                mission_title: titulo,
                reward: Number(recompensa),
                pay_type: tipoPagamento || 'atlix',
                user_id: auth.currentUser.uid,
                user_name: window.userProfile?.nome || "Membro Atlas",
                proof_url: base64data,
                responses: respostas, // 📋 O Checklist respondido
                distance_meters: distanciaFinal, // 📍 Distância exata da foto
                status: 'pending',
                created_at: serverTimestamp(),
                execution_time: new Date().toISOString() // ⏱️ Timestamp Automático
            });

            // Atualiza contadores
            const { updateDoc, increment } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            await updateDoc(doc(db, "missions", id), { pessoas_realizando: increment(-1) });
            
            localStorage.removeItem(`fazendo_${id}`);
            alert("✅ PROVA ENVIADA!\nSeus dados estão em auditoria.");
            if(btn) btn.innerText = "✅ ENVIADO";
            window.carregarMissoes(); // Recarrega o radar
        };
    } catch (err) {
        console.error(err);
        alert("❌ Falha no envio da prova.");
        if(btn) { btn.disabled = false; btn.innerText = "Tentar Novamente"; }
    }
}

// 📄 VISUALIZADOR DE COMPROVANTE (MATA-SUPORTE)
// Gil, esta função abre a imagem do PIX que você anexou no Admin para o usuário conferir.
window.abrirComprovantePIX = (url) => {
    if (!url) return alert("Aguardando processamento do comprovante...");
    
    const win = window.open();
    win.document.write(`
        <html>
            <head><title>Comprovante Atlivio</title></head>
            <body style="margin:0; background:#0f172a; display:flex; justify-content:center; align-items:center;">
                <img src="${url}" style="max-width:100%; max-height:100vh; border-radius:12px; shadow:0 0 20px rgba(0,0,0,0.5);">
            </body>
        </html>
    `);
};

// 📐 FÓRMULA MATEMÁTICA DE PROXIMIDADE (HAVERSINE)
// Gil, esta função calcula a distância exata entre dois pontos no globo terrestre
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

// 🔐 SOLDAGEM GLOBAL ATLAS V2026.PRO (FINAL)
// Gil, aqui entregamos todas as funções para o navegador reconhecer os cliques nos botões
window.carregarMissoes = carregarMissoes;
window.renderizarMissaoCards = carregarMissoes; 
window.abrirProvaMissao = abrirProvaMissao; // ✅ Resolve o erro de 'undefined' ao clicar
window.verTutorialMissao = verTutorialMissao; // ✅ Ativa o botão de tutorial
window.abrirComprovantePIX = abrirComprovantePIX; // 🚀 Liberado para o App

// 📜 MOTOR DE HISTÓRICO DE MISSÕES (V2026)
// Gil, esta função busca tudo o que o usuário já fez e mostra se foi aprovado ou pago.
async function carregarMissoesRealizadas() {
    const container = document.getElementById('lista-missoes-realizadas');
    if (!container) return;

    container.innerHTML = `<div class="py-10 text-center"><div class="loader mx-auto border-blue-500"></div></div>`;

    try {
        const { collection, query, where, orderBy, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        // 🛰️ A CONSULTA MESTRA (Requer o índice que o robô solicitou)
        const q = query(
            collection(window.db, "mission_submissions"),
            where("user_id", "==", auth.currentUser.uid),
            orderBy("created_at", "desc")
        );

        onSnapshot(q, (snap) => {
            if (snap.empty) {
                container.innerHTML = `<p class="text-center text-gray-500 text-[10px] py-10 italic">Você ainda não realizou nenhuma missão.</p>`;
                return;
            }

            container.innerHTML = "";
            snap.forEach(doc => {
                const m = doc.data();
                const statusMap = {
                    'pending': { txt: 'EM ANÁLISE ⏳', css: 'text-amber-500 bg-amber-500/10' },
                    'approved_pending_pix': { txt: 'APROVADA (PIX PENDENTE) 💸', css: 'text-blue-500 bg-blue-500/10' },
                    'paid_real': { txt: 'PAGO VIA PIX ✅', css: 'text-emerald-500 bg-emerald-500/10' },
                    'rejected': { txt: 'RECUSADA ❌', css: 'text-red-500 bg-red-500/10' }
                };
                const st = statusMap[m.status] || { txt: m.status, css: 'text-gray-500 bg-gray-500/10' };

                container.innerHTML += `
                    <div class="bg-white border border-gray-100 p-4 rounded-2xl mb-3 shadow-sm animate-fadeIn">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-black text-gray-800 text-[11px] uppercase">${m.mission_title}</h4>
                            <span class="text-[7px] font-black px-2 py-1 rounded-full uppercase ${st.css}">${st.txt}</span>
                        </div>
                        <p class="text-[9px] text-gray-400 italic mb-3">Recompensa: R$ ${Number(m.reward).toFixed(2).replace('.', ',')}</p>
                        
                        ${m.status === 'paid_real' && m.receipt_url ? `
                            <button onclick="window.abrirComprovantePIX('${m.receipt_url}')" class="w-full bg-emerald-50 text-emerald-600 border border-emerald-100 py-2.5 rounded-xl font-black text-[9px] uppercase hover:bg-emerald-100 transition flex items-center justify-center gap-2">
                                📄 Ver Comprovante PIX
                            </button>
                        ` : ''}
                    </div>
                `;
            });
        });
    } catch (e) {
        console.error("Erro no histórico:", e);
        container.innerHTML = `<p class="text-center text-red-500 text-[9px]">Erro ao carregar histórico.</p>`;
    }
}

window.carregarMissoesRealizadas = carregarMissoesRealizadas;

// ⏲️ SENTINELA DE DESISTÊNCIA: Devolve a vaga ao radar se o usuário não enviar a prova em 20 min
window.iniciarCronometroDesistencia = (missionId) => {
    setTimeout(async () => {
        const aindaFazendo = localStorage.getItem(`fazendo_${missionId}`);
        if (aindaFazendo) {
            const { doc, updateDoc, increment } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const missionRef = doc(window.db, "missions", missionId);
            await updateDoc(missionRef, {
                slots_disponiveis: increment(1),
                pessoas_realizando: increment(-1),
                updated_at: serverTimestamp()
            });
            localStorage.removeItem(`fazendo_${missionId}`);
            console.log("♻️ Vaga devolvida ao radar Atlivio por inatividade.");
        }
    }, 20 * 60 * 1000); 
};

// 📋 MOTOR DE INTERFACE: Checklist Sim/Não
window.abrirModalChecklist = (perguntas, callback) => {
    // Cria o overlay do modal
    const overlay = document.createElement('div');
    overlay.className = "fixed inset-0 z-[999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn";
    
    let respostas = {};
    let perguntaAtual = 0;

    const renderPergunta = () => {
        const p = perguntas[perguntaAtual];
        overlay.innerHTML = `
            <div class="w-full max-w-sm bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl text-center space-y-6">
                <div class="space-y-2">
                    <p class="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Checklist Atlas (${perguntaAtual + 1}/${perguntas.length})</p>
                    <h3 class="text-xl font-black text-white leading-tight">${p}</h3>
                </div>

                <div class="grid grid-cols-2 gap-4 pt-4">
                    <button id="btn-nao" class="py-5 bg-slate-800 text-white rounded-3xl font-black uppercase text-xs border border-white/5 active:scale-95 transition-all">Não ❌</button>
                    <button id="btn-sim" class="py-5 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs shadow-lg shadow-blue-900/40 active:scale-95 transition-all">Sim ✅</button>
                </div>
            </div>
        `;

        overlay.querySelector('#btn-sim').onclick = () => prosseguir('Sim');
        overlay.querySelector('#btn-nao').onclick = () => prosseguir('Não');
    };

    const prosseguir = (valor) => {
        respostas[perguntas[perguntaAtual]] = valor;
        perguntaAtual++;

        if (perguntaAtual < perguntas.length) {
            renderPergunta();
        } else {
            overlay.remove();
            callback(respostas);
        }
    };

    document.body.appendChild(overlay);
    renderPergunta();
};

console.log("🚀 [Missions] Sistema de Vagas e Escassez Sincronizado!");
