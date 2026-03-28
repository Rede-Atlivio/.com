import { db, auth } from '../config.js';
import { collection, getDocs, query, where, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const styleAtlas = document.createElement('style');
styleAtlas.innerHTML = `
    @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .globo-atlas { animation: spin-slow 8s linear infinite; display: inline-block; }  
    .card-atlas-premium h3 { color: #ffffff !important; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
    .card-atlas-premium { 
        background: linear-gradient(145deg, #0f172a, #1e293b);
        border: 1px solid rgba(59, 130, 246, 0.3);
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
`;
document.head.appendChild(styleAtlas);

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

    // Se o GPS global ainda não foi pego, pegamos agora para as Micro Tarefas
    if (!window.userLocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                window.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                carregarMissoes(); // Recarrega agora com a posição na mão
            },
            (err) => { console.error("GPS negado ou falhou"); },
            { enableHighAccuracy: true }
        );
    }
    container.innerHTML = `<div class="py-10 text-center"><div class="loader mx-auto border-blue-500"></div></div>`;

    try {
        // Busca apenas missões ativas no banco
        const q = query(collection(db, "missions"), where("active", "==", true), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            container.innerHTML = `<p class="text-center text-gray-500 text-xs py-10 italic">Nenhuma missão disponível no seu radar agora.</p>`;
            return;
        }

        // Gil, trocamos o pontilhado por uma borda sólida neon e um fundo sutil para dar peso de "Área de Negócios"
container.innerHTML = `
    <button onclick="document.getElementById('modal-marketing-b2b').classList.remove('hidden')" class="w-full bg-blue-50/50 border-2 border-blue-400 p-5 rounded-[2rem] flex items-center gap-4 mb-8 shadow-[0_10px_20px_rgba(59,130,246,0.15)] active:scale-95 transition-all hover:bg-blue-100">
        <div class="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-blue-100">🏢</div>
        <div class="text-left">
            <p class="text-[11px] font-black text-blue-900 uppercase leading-tight">Micro Tarefas para Empresas?</p>
            <p class="text-[9px] text-blue-600 font-bold uppercase tracking-wide opacity-80">Transforme sua operação com o Atlas Vivo ➜</p>
        </div>
    </button>
`;

       snap.forEach(doc => {
            const m = doc.data();
            const id = doc.id;

            // 🛰️ VALIDAÇÃO DE PROXIMIDADE ATLAS
            const isLocal = m.latitude && m.longitude;
            const raioMetros = Number(m.radius) || 0;
            
            if (isLocal && raioMetros > 0 && window.userLocation) {
                const distKm = calcularDistancia(window.userLocation.lat, window.userLocation.lng, m.latitude, m.longitude);
                if ((distKm * 1000) > raioMetros) return; 
            }

            // PADRÃO VISUAL ATLIVIO: Todas escuras com Globo girando
           const cardClass = 'card-atlas-premium text-white';
            const iconAtlas = '<span class="globo-atlas">🌍</span>';
            const badgeClass = 'bg-blue-500/20 text-blue-300';

            // 🛡️ SENSOR DE DISPOSITIVO: Verifica se é Celular ou PC
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

           // 🪙 V2026.ATLIVIO: Unificação para Créditos de Acesso
            // Toda missão agora gera crédito interno, independente se a origem foi B2B ou Admin
            const labelMoeda = 'CRÉDITOS ATLIX 🪙';
            const colorMoeda = 'text-amber-500'; // Cor padrão ouro para a moeda Atlix

            // 🎨 Layout Evoluído: Fixamos 'text-white' para combinar com o fundo escuro
            container.innerHTML += `
                <div class="${cardClass} p-5 rounded-3xl border border-white/10 shadow-xl transition-all animate-fadeIn mb-4">
                    <div class="flex justify-between items-start mb-3">
                        <div class="${badgeClass} p-2 rounded-2xl text-xl flex items-center justify-center w-12 h-12 shadow-inner">
                            ${iconAtlas}
                        </div>
                        <div class="text-right">
                            <p class="text-[7px] font-black ${colorMoeda} uppercase tracking-[0.15em] mb-0.5">${labelMoeda}</p>
                            <p class="text-xl font-black text-white tracking-tighter">
                                ${Number(m.reward).toFixed(2).replace('.', ',')} AX
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 mb-2">
                        <span class="flex h-2 w-2 rounded-full ${m.slots_disponiveis > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}"></span>
                        <p class="text-[9px] font-black uppercase tracking-widest ${m.slots_disponiveis > 0 ? 'text-emerald-400' : 'text-red-400'}">
                            ${m.slots_disponiveis > 0 ? `${m.slots_disponiveis} Vagas Restantes` : 'Missão Esgotada'}
                        </p>
                        ${m.pessoas_realizando > 0 ? `<span class="text-[8px] text-amber-500 font-bold ml-auto">⚠️ ${m.pessoas_realizando} realizando agora</span>` : ''}
                    </div>
                    
                    <h3 class="font-black text-white text-sm uppercase mb-1">${m.title}</h3>
                    <p class="text-[10px] text-gray-500 leading-relaxed mb-4">${m.description}</p>

                    <div class="flex gap-2">
                        ${m.video_id ? `
                            <button onclick="window.verTutorialMissao('${m.video_id}')" class="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black text-[9px] uppercase hover:bg-slate-200 transition">
                                📖 Tutorial
                            </button>
                        ` : ''}

                       ${isMobile ? `
                            <button onclick="window.abrirProvaMissao('${id}', '${m.title}', ${m.reward}, '${m.pay_type || 'atlix'}', '${m.b2b_owner_uid || ''}')" class="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-[9px] uppercase shadow-lg active:scale-95 transition-all">
                                Realizar Missão ➜
                            </button>
                        ` : `
                            <button onclick="alert('📱 Missão Exclusiva para Celular\\n\\nPara garantir a veracidade das fotos, esta tarefa só pode ser cumprida através do aplicativo no seu smartphone.')" class="flex-[2] bg-gray-700 text-gray-400 py-3 rounded-xl font-black text-[9px] uppercase cursor-not-allowed">
                                🔒 Use o Celular
                            </button>
                        `}
                    </div>
                </div>
            `;
        });
    } catch (e) {
        console.error("Erro ao carregar missões:", e);
        container.innerHTML = `<p class="text-center text-red-500 text-[10px]">Erro de conexão com o radar.</p>`;
    }
}

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
async function abrirProvaMissao(id, titulo, recompensa, tipoPagamento, b2bOwnerId) {
    const { collection, getDocs, query, where, doc, getDoc, runTransaction, increment } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    
    const btn = document.querySelector(`button[onclick*="${id}"]`);
    if(!btn) return;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "🔍 RESERVANDO VAGA...";

    try {
        // 🛡️ TRANSAÇÃO DE VAGA: Verifica se tem vaga e reserva em 1 milésimo de segundo
        const missionRef = doc(window.db, "missions", id);
        
        await runTransaction(window.db, async (transaction) => {
            const mSnap = await transaction.get(missionRef);
            const m = mSnap.data();

            if (m.slots_disponiveis <= 0) throw "Desculpe, esta missão acabou de esgotar!";
            
            // 🔍 Check de duplicidade: Usuário já fez?
            const qCheck = query(collection(window.db, "mission_submissions"), where("user_id", "==", auth.currentUser.uid), where("mission_id", "==", id));
            const sCheck = await getDocs(qCheck);
            if (!sCheck.empty) throw "Você já realizou esta missão!";

            // ✅ TUDO OK: Reserva a vaga diminuindo o disponível e aumentando o 'realizando'
            transaction.update(missionRef, {
                slots_disponiveis: increment(-1),
                pessoas_realizando: increment(1)
            });
       });

        // 🛰️ Vaga garantida. O sistema agora prepara a interface de captura.
        localStorage.setItem(`fazendo_${id}`, "true");
        window.iniciarCronometroDesistencia(id);

       // 🛰️ Marcador de Execução: Impede que a vaga fique presa se o app fechar
        localStorage.setItem(`fazendo_${id}`, "true");
        window.iniciarCronometroDesistencia(id);

        // Se passar na trava, segue o fluxo normal
        // Gil, pedimos o OK primeiro para garantir que o sistema não "atropele" a câmera
        if (!confirm(`Deseja iniciar a missão: ${titulo}?\n\nO sistema abrirá sua câmera agora.`)) {
            btn.disabled = false;
            btn.innerText = originalText;
            return;
        }

        const inputCamera = document.getElementById('camera-input');
        // Limpa o valor anterior para garantir que a troca de arquivos funcione sempre
        inputCamera.value = "";
    navigator.geolocation.getCurrentPosition(async (pos) => {
        window.currentMissionLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }, null, { enableHighAccuracy: true });

   inputCamera.onchange = async (e) => {
            const file = e.target.files[0];
            
            // Reseta o valor do input imediatamente para permitir novas capturas sem erro
            const currentInput = e.target;
            
            if (!file) {
                btn.disabled = false;
                btn.innerText = originalText;
                currentInput.value = ""; // Limpa o cache do evento
                return;
            }
            
          // Passa o ID do dono da empresa para o motor de processamento
           await processarEnvioMissao(id, titulo, recompensa, tipoPagamento, file, b2bOwnerId);
            currentInput.value = ""; // Limpa após o processamento
        };

      // 🚀 TIRO ÚNICO: Dispara a câmera com o DNA do dono já injetado no evento
        // Gil, garantimos que o b2bOwnerId não se perca na memória do clique
        inputCamera.dataset.owner = b2bOwnerId;
        inputCamera.click();

    } catch (err) {
        console.error("Erro na trava:", err);
        btn.disabled = false;
        btn.innerText = originalText;
    }
}
// 📦 MOTOR DE COMPRESSÃO E UPLOAD V2026 (MAESTRO)
async function processarEnvioMissao(id, titulo, recompensa, tipoPagamento, arquivo, b2bOwnerId) {
    const btn = document.querySelector(`button[onclick*="${id}"]`);
    const originalText = btn.innerText;
    
    try {
        btn.disabled = true;
        btn.innerText = "⏳ COMPRIMINDO...";

        const bitmap = await createImageBitmap(arquivo);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 1200 / Math.max(bitmap.width, bitmap.height);
        canvas.width = bitmap.width * scale;
        canvas.height = bitmap.height * scale;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.7));
        btn.innerText = "🚀 ENVIANDO PROVA...";

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64data = reader.result;
            // 🛰️ RECUPERAÇÃO DE DNA: Se o b2bOwnerId falhou na função, buscamos no dataset do input
            const donoFinal = b2bOwnerId || document.getElementById('camera-input').dataset.owner;

          // 🚀 GRAVAÇÃO ATLIVIO V2026: Registro Único de Prova
            await addDoc(collection(db, "mission_submissions"), {
                mission_id: id,
                owner_id: donoFinal, // ──▶ O campo principal que o índice composto espera
                mission_title: titulo,
                mission_title: titulo,
                reward: recompensa,
                pay_type: 'atlix', // Força o sistema a reconhecer como crédito interno
                user_id: auth.currentUser.uid,
                user_name: window.userProfile?.nome || "Usuário Atlivio",
                proof_url: base64data,
                location: window.currentMissionLocation || null,
                status: 'pending', // Aguarda aprovação para mover da reserva para o prestador
                created_at: serverTimestamp()
            });
            // ✅ CONFIRMAÇÃO DE ENTREGA: Remove o usuário do contador de "realizando"
            const { doc, updateDoc, increment } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const missionRef = doc(window.db, "missions", id);
            await updateDoc(missionRef, { pessoas_realizando: increment(-1) });
            
            // Limpa o rastro local para o cronômetro não devolver a vaga por erro
            localStorage.removeItem(`fazendo_${id}`);

            alert("✅ SUCESSO! Sua prova foi enviada para análise.");
            btn.innerText = "✅ ENVIADO";
        };
    } catch (err) {
        alert("❌ Falha no envio.");
        btn.disabled = false;
        btn.innerText = originalText;
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

console.log("🚀 [Missions] Sistema de Vagas e Escassez Sincronizado!");
