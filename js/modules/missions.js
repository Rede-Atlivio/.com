import { db, auth } from '../config.js';
import { collection, getDocs, query, where, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🚀 V2026: MOTOR DE MISSÕES GEOLOCALIZADAS (ATLAS VIVO)
// 🎨 Estilização Dinâmica para o Globo Rodando e Card Atlas
const styleAtlas = document.createElement('style');
styleAtlas.innerHTML = `
    @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .globo-atlas { animation: spin-slow 8s linear infinite; display: inline-block; }
    .card-atlas-premium { 
        background: linear-gradient(145deg, #0f172a, #1e293b);
        border: 1px solid rgba(59, 130, 246, 0.3);
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
`;
document.head.appendChild(styleAtlas);

export async function initMissions() {
    console.log("🌍 Atlas Vivo: Sincronizando radar geográfico...");
    const container = document.getElementById('lista-missoes');
    if (!container) return;

    // Exporta funções para o mundo global (HTML)
    window.abrirProvaMissao = abrirProvaMissao;
    window.verTutorialMissao = verTutorialMissao;

    await renderizarMissaoCards();
}

// 🏗️ DESENHA OS CARDS NA TELA DO USUÁRIO
async function renderizarMissaoCards() {
    const container = document.getElementById('lista-missoes');
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

            // 🌍 V2026: Identifica se é uma missão Atlas (Geolocalizada) ou Tarefa Simples
            const isAtlas = m.latitude && m.longitude;
            const cardClass = isAtlas ? 'card-atlas-premium text-white' : 'bg-white text-slate-800';
            const iconAtlas = isAtlas ? '<span class="globo-atlas">🌍</span>' : '🎯';
            const badgeClass = isAtlas ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600';

            // 🎨 Layout Evoluído com Diferenciação de Produto
            container.innerHTML += `
                <div class="${cardClass} p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all animate-fadeIn mb-4">
                    <div class="flex justify-between items-start mb-3">
                        <div class="${badgeClass} p-2 rounded-2xl text-xl flex items-center justify-center w-12 h-12">
                            ${iconAtlas}
                        </div>
                        <div class="text-right">
                            <p class="text-[8px] font-black text-gray-400 uppercase tracking-widest">Recompensa</p>
                            <p class="text-lg font-black text-emerald-600">R$ ${m.reward.toFixed(2).replace('.', ',')}</p>
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

                        <button onclick="window.abrirProvaMissao('${id}', '${m.title}', ${m.reward})" class="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-[9px] uppercase shadow-lg shadow-blue-200 active:scale-95 transition">
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

// 📽️ ABRE O TUTORIAL (MODAL DE VÍDEO)
function verTutorialMissao(videoId) {
    // Aqui no futuro chamaremos o modal unificado de vídeo
    alert(`🎥 Iniciando Tutorial Veo 3...\n(ID do Vídeo: ${videoId})\n\nGil, o modal de vídeo será configurado na próxima fase.`);
}

// 📸 GATILHO DE PROVA (CÂMERA + GPS)
async function abrirProvaMissao(id, titulo, recompensa) {
    const confirmar = confirm(`Deseja iniciar a missão: ${titulo}?\n\nO sistema irá solicitar sua localização atual.`);
    if (!confirmar) return;

    // 🛰️ CAPTURA GPS EM TEMPO REAL
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log(`📍 GPS Capturado: ${latitude}, ${longitude}`);
        
        // Dispara a câmera traseira
        document.getElementById('camera-input').click();
        
        // Gil, aqui deixamos o gancho para o upload da foto que faremos no Bloco 3
        console.log("📸 Aguardando captura da imagem...");
        
    }, (err) => {
        alert("❌ Erro: Para ganhar a recompensa, você precisa permitir o GPS.");
    });
}
