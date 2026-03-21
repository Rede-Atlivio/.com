import { db, auth } from '../config.js';
// Gil, removemos o 'addDoc' de criação e adicionamos 'getDoc' e 'updateDoc' para o fluxo de provas do prestador
import { collection, getDocs, getDoc, doc, query, where, updateDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// 🚀 INICIALIZADOR ATLAS V2026 (FOCO PRESTADOR)
// Gil, agora este arquivo cuida apenas da visão de quem cumpre as tarefas.
// Gil, o comando 'export' é o que dá permissão para o arquivo principal enxergar esta função
export async function initMissions() {
    console.log("🌍 Atlas Vivo: Sincronizando Radar de Micro Tarefas...");
    
    const containerPrestador = document.getElementById('lista-missoes');
    if (!containerPrestador) return;
    
    // Inicia a carga das missões disponíveis no mapa
    await carregarMissoes(); 
};


// 🏗️ MOTOR DE CARGA PRESTADOR (LISTA DE EMPREGOS)
async function carregarMissoes() {
    const container = document.getElementById('lista-missoes');
    if (!container) return;
    
    // Limpa e prepara container do prestador
    container.innerHTML = `<div id="lista-cards-real" class="space-y-4"></div>`;
    carregarMissoesInner();
}

// Criamos essa função auxiliar para o motor de carga funcionar dentro do novo container
async function carregarMissoesInner() {
    // AQUI ESTAVA O ERRO: Não usamos 'const' novamente se ela já foi capturada
    const containerInner = document.getElementById('lista-cards-real');
    if (!containerInner) return;

  // 🛰️ GPS ÚNICO ATLAS: Captura a posição apenas se necessário, sem criar loops.
    if (!window.userLocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                window.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                console.log("📍 Localização capturada via Missions.");
                // Chamamos a busca interna diretamente para não resetar o container
                carregarMissoesInner(); 
            },
            (err) => { console.warn("GPS negado: Mostrando missões globais."); },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    }
    const listaCards = document.getElementById('lista-cards-real');
    if(listaCards) listaCards.innerHTML = `<div class="py-10 text-center"><div class="loader mx-auto border-blue-500"></div></div>`;

    try {
        // Busca apenas missões ativas no banco
        const q = query(collection(db, "missions"), where("active", "==", true), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        
       if (snap.empty) {
            if(listaCards) listaCards.innerHTML = `<p class="text-center text-gray-500 text-xs py-10 italic">Nenhuma missão disponível no seu radar agora.</p>`;
            return;
        }

        if(listaCards) listaCards.innerHTML = ""; // Limpa loader

        // 📣 CONVITE B2B (PARA PRESTADORES): Agora integrado ao sistema de abas oficial
        const perfilAcesso = window.userProfile?.perfil || 'prestador';
        if (perfilAcesso === 'prestador' && listaCards) {
            listaCards.innerHTML += `
                <div onclick="switchTab('b2b_gestao')" class="bg-gradient-to-r from-amber-900/40 to-slate-900 p-4 rounded-3xl border border-amber-500/30 mb-6 cursor-pointer hover:scale-[1.02] transition-all group">
                    <div class="flex items-center gap-4">
                        <div class="bg-amber-600 p-3 rounded-2xl shadow-lg group-hover:bg-amber-500 transition">
                            <span class="text-xl">💼</span>
                        </div>
                        <div>
                            <h4 class="text-white font-black text-[11px] uppercase tracking-tighter">Encomendar Inteligência Atlas</h4>
                            <p class="text-[8px] text-amber-200/70 uppercase font-bold tracking-widest">Clique para alternar para perfil Empresa</p>
                        </div>
                        <div class="ml-auto text-amber-500">➜</div>
                    </div>
                </div>
            `;
        }

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

            // 💰 V2026.PRO: Identifica a moeda de recompensa
            const isRealMoney = m.pay_type === 'real';
            const labelMoeda = isRealMoney ? 'PAGAMENTO EM PIX 💰' : 'CRÉDITOS ATLIX 🪙';
            const colorMoeda = isRealMoney ? 'text-emerald-500' : 'text-amber-500';

            // 🎨 Layout Evoluído: Fixamos 'text-white' para combinar com o fundo escuro
            if(listaCards) listaCards.innerHTML += `
                <div class="${cardClass} p-5 rounded-3xl border border-white/10 shadow-xl transition-all animate-fadeIn mb-4">
                    <div class="flex justify-between items-start mb-3">
                        <div class="${badgeClass} p-2 rounded-2xl text-xl flex items-center justify-center w-12 h-12 shadow-inner">
                            ${iconAtlas}
                        </div>
                        <div class="text-right">
                            <p class="text-[7px] font-black ${colorMoeda} uppercase tracking-[0.15em] mb-0.5">${labelMoeda}</p>
                            <p class="text-xl font-black text-white tracking-tighter">
                                R$ ${Number(m.reward).toFixed(2).replace('.', ',')}
                            </p>
                        </div>
                    </div>
                    
                    <h3 class="font-black text-white text-sm uppercase mb-1 tracking-tight">${m.title}</h3>
                    <p class="text-[10px] text-gray-500 leading-relaxed mb-4">${m.description}</p>

                    <div class="flex gap-2">
                        ${m.video_id ? `
                            <button onclick="window.verTutorialMissao('${m.video_id}')" class="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black text-[9px] uppercase hover:bg-slate-200 transition">
                                📖 Tutorial
                            </button>
                        ` : ''}

                        ${isMobile ? `
                            <button onclick="window.abrirProvaMissao('${id}', '${m.title}', ${m.reward}, '${m.pay_type || 'atlix'}')" class="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-[9px] uppercase shadow-lg active:scale-95 transition">
                                Colaborar na Missão ➜
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

// 📸 MOTOR DE EXECUÇÃO V2026: Escudo de Duplicidade & Câmera
async function abrirProvaMissao(id, titulo, recompensa, tipoPagamento) {
    // Gil, aqui o robô verifica se o usuário já tem algum envio (pendente ou pago) para este ID de missão
    const { collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    
    // Bloqueia o clique e mostra o loader no botão para o usuário saber que estamos validando
    const btn = document.querySelector(`button[onclick*="${id}"]`);
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "🔍 VALIDANDO...";

    try {
        const qCheck = query(
            collection(window.db, "mission_submissions"), 
            where("user_id", "==", auth.currentUser.uid),
            where("mission_id", "==", id)
        );
        const snapCheck = await getDocs(qCheck);

        // 🛡️ TRAVA DE SEGURANÇA: Se encontrar qualquer registro, barra a participação
        if (!snapCheck.empty) {
            alert(`⚠️ OPS! Você já participou desta missão.\n\nCada missão só pode ser realizada uma única vez por usuário.`);
            btn.disabled = false;
            btn.innerText = originalText;
            return;
        }

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
            
           await processarEnvioMissao(id, titulo, recompensa, tipoPagamento, file);
            currentInput.value = ""; // Limpa após o processamento
        };

        // 🚀 TIRO ÚNICO: Dispara a câmera apenas UMA VEZ após toda a lógica acima estar montada
        inputCamera.click();
    } catch (err) {
        console.error("Erro na trava:", err);
        btn.disabled = false;
        btn.innerText = originalText;
    }
}
// 📦 MOTOR DE COMPRESSÃO E UPLOAD V2026 (MAESTRO)
async function processarEnvioMissao(id, titulo, recompensa, tipoPagamento, arquivo) {
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
            const moedaDestaMissao = (tipoPagamento === 'real') ? 'BRL' : 'ATLIX';
           // 🛡️ ESCUDO DE PRECISÃO (GPS MATCH): Compara local do usuário com o local da missão
            let gpsStatus = 'no_location';
            
            // Busca os dados da missão original que estão guardados no card ou memória
            const missaoRef = doc(db, "missions", id);
            const missaoSnap = await getDoc(missaoRef);
            const mData = missaoSnap.exists() ? missaoSnap.data() : null;

            if (mData && mData.latitude && window.currentMissionLocation) {
                const distanciaMetros = calcularDistancia(
                    window.currentMissionLocation.lat, 
                    window.currentMissionLocation.lng, 
                    mData.latitude, 
                    mData.longitude
                ) * 1000;

                // Gil, se ele estiver dentro do raio definido pelo B2B (ou padrão 500m), é MATCH!
                const raioPermitido = mData.radius || 500;
                gpsStatus = (distanciaMetros <= raioPermitido) ? 'match' : 'suspect';
            }

            await addDoc(collection(db, "mission_submissions"), {
                moeda: moedaDestaMissao,
                mission_id: id,
                mission_title: titulo,
                reward: recompensa,
                pay_type: tipoPagamento,
                user_id: auth.currentUser.uid,
                user_name: window.userProfile?.nome || "Usuário Atlivio",
                proof_url: base64data,
                location: window.currentMissionLocation || null,
                gps_status: gpsStatus, // ✅ Carimbo para o B2B ver se é fraude
                b2b_owner_uid: mData?.b2b_owner_uid || null, // Garante que a foto vá para o painel do cliente certo
                status: 'pending',
                created_at: serverTimestamp()
            });
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
window.calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Raio da Terra em KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

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

// A gestão de troca de perfil agora é feita pelo Vigilante centralizado no app.js
window.carregarMissoesRealizadas = carregarMissoesRealizadas;

// 📸 Visualizador de Provas para o B2B
window.visualizarProva = (url) => {
    const win = window.open();
    win.document.write(`<body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;"><img src="${url}" style="max-width:100%;max-height:100vh;"></body>`);
};

console.log("✅ [Atlas] Motor Híbrido Estabilizado V62.6");
