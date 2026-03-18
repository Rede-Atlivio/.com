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

        container.innerHTML = ""; // Limpa loader

       snap.forEach(doc => {
            const m = doc.data();
            const id = doc.id;

            // 🛰️ VALIDAÇÃO DE PROXIMIDADE ATLAS
            const isAtlas = m.latitude && m.longitude;
            
            if (isAtlas && window.userLocation) {
                const distKm = calcularDistancia(window.userLocation.lat, window.userLocation.lng, m.latitude, m.longitude);
                const raioMetros = Number(m.radius) || 0;
                const distMetros = distKm * 1000;

                // Se o raio for 0, a missão é global. Se tiver valor, filtramos.
                if (raioMetros > 0 && distMetros > raioMetros) {
                    return; 
                }
            }
            const cardClass = isAtlas ? 'card-atlas-premium text-white' : 'bg-white text-slate-800';
            const iconAtlas = isAtlas ? '<span class="globo-atlas">🌍</span>' : '🎯';
            const badgeClass = isAtlas ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600';

           // 💰 V2026.PRO: Identifica a moeda de recompensa (CRÉDITOS vs PIX)
            const isRealMoney = m.pay_type === 'real';
            const labelMoeda = isRealMoney ? 'PAGAMENTO EM PIX 💰' : 'CRÉDITOS ATLIX 🪙';
            const colorMoeda = isRealMoney ? 'text-emerald-500' : 'text-amber-500';

            // 🎨 Layout Evoluído com Transparência Financeira
            container.innerHTML += `
                <div class="${cardClass} p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all animate-fadeIn mb-4">
                    <div class="flex justify-between items-start mb-3">
                        <div class="${badgeClass} p-2 rounded-2xl text-xl flex items-center justify-center w-12 h-12 shadow-inner">
                            ${iconAtlas}
                        </div>
                        <div class="text-right">
                            <p class="text-[7px] font-black ${colorMoeda} uppercase tracking-[0.15em] mb-0.5">${labelMoeda}</p>
                            <p class="text-xl font-black ${isAtlas ? 'text-white' : 'text-slate-800'} tracking-tighter">
                                R$ ${m.reward.toFixed(2).replace('.', ',')}
                            </p>
                        </div>
                    </div>

                    <h3 class="font-black text-slate-800 text-sm uppercase mb-1">${m.title}</h3>
                    <p class="text-[10px] text-gray-500 leading-relaxed mb-4">${m.description}</p>

                    <div class="flex gap-2">
                        ${m.video_id ? `
                            <button onclick="window.verTutorialMissao('${m.video_id}')" class="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black text-[9px] uppercase hover:bg-slate-200 transition">
                                📖 Tutorial
                            </button>
                        ` : ''}

                        <button onclick="window.abrirProvaMissao('${id}', '${m.title}', ${m.reward}, '${m.pay_type || 'atlix'}')" class="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-[9px] uppercase shadow-lg shadow-blue-200 active:scale-95 transition">
                            Realizar Missão ➜
                        </button>
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

// 📸 MOTOR DE EXECUÇÃO: Valida distância e abre câmera
async function abrirProvaMissao(id, titulo, recompensa, tipoPagamento) {
    const confirmar = confirm(`Deseja iniciar a missão: ${titulo}?\n\nSe a missão for presencial o sistema verificará se você está no local correto.`);
    if (!confirmar) return;

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        
        // 🛰️ VERIFICAÇÃO DE DISTÂNCIA REAL-TIME
        // Buscamos os dados da missão para comparar
        const q = query(collection(db, "missions"), where("__name__", "==", id));
        const snap = await getDocs(q);
        const m = snap.docs[0]?.data();

        if (m && m.latitude && m.longitude) {
            const distKm = calcularDistancia(latitude, longitude, m.latitude, m.longitude);
            const raioM = Number(m.radius) || 500;
            
            if (distKm * 1000 > raioM) {
                return alert(`📍 LOCAL INCORRETO: Você está muito longe deste local para realizar a missão. Aproxime-se do endereço indicado!`);
            }
        }

        // Se passar na distância ou for online: Abre câmera
        document.getElementById('camera-input').click();
        
    }, (err) => {
        alert("⚠️ ATENÇÃO: Para realizar esta missão e receber o pagamento, você precisa ativar o GPS do seu celular.");
    }, { enableHighAccuracy: true });
}

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

console.log("🚀 [Missions] Sistema Atlas Vivo 100% Soldado e Visível!");
