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

// 🏗️ MOTOR DE CARGA ATLAS VIVO V2026 (PORTAL HÍBRIDO)
async function carregarMissoes() {
    const container = document.getElementById('lista-missoes');
    if (!container) return;

    // 🛡️ SENSOR DE PERFIL: Identifica se é Cliente/Empresa para liberar o portal de encomendas
    const perfilUsuario = window.userProfile?.perfil || 'prestador';
    const b2bButtonId = 'btn-encomendar-atlas';

    if (perfilUsuario === 'cliente' && !document.getElementById(b2bButtonId)) {
        const btnB2B = document.createElement('div');
        btnB2B.id = b2bButtonId;
        btnB2B.className = "fixed bottom-24 right-6 z-[100] animate-bounce";
        btnB2B.innerHTML = `
            <button onclick="window.abrirWizardB2B()" class="bg-amber-600 hover:bg-amber-500 text-white p-4 rounded-3xl shadow-2xl flex flex-col items-center gap-1 transition-all active:scale-95 border-2 border-white/20">
                <span class="text-2xl">💼</span>
                <p class="text-[9px] font-black uppercase tracking-tighter text-center leading-none">Encomendar<br>Inteligência Atlas</p>
                <div class="h-[1px] w-full bg-white/20 my-1"></div>
                <p class="text-[7px] opacity-90 uppercase font-black text-amber-100">Exclusivo para Empresas</p>
            </button>
        `;
       document.body.appendChild(btnB2B);
    }

    // 🛡️ SENTINELA DE PERFIL: Trava de segurança que impede Prestadores de acessar o Wizard
    window.abrirWizardB2B = () => {
        // Verifica se o perfil no banco de dados é 'cliente'
        const perfilAtivo = window.userProfile?.perfil || 'prestador';
        
        if (perfilAtivo !== 'cliente') {
            return alert("🚫 ACESSO NEGADO\n\nEste portal é exclusivo para Empresas.\n\nSe você é um cliente B2B, alterne seu perfil nas configurações para encomendar inteligência.");
        }

        // 🧙‍♂️ WIZARD ATLAS B2B: PASSO 1 (TEMPLATES PADRONIZADOS)
        const modal = document.getElementById('modal-editor');
        const content = document.getElementById('modal-content');
        if(!modal || !content) return alert("Erro: Estrutura de Modal não encontrada.");

        modal.classList.remove('hidden');
        window.wizardB2BData = {}; // Reseta memória da encomenda atual

        content.innerHTML = `
            <div id="wizard-atlas-container" class="space-y-6 animate-fadeIn pb-6">
                <div class="text-center space-y-1">
                    <h3 class="text-xl font-black text-white italic uppercase tracking-tighter">Inteligência Atlas</h3>
                    <p class="text-[9px] text-blue-400 font-bold uppercase tracking-[0.2em]">Passo 1: Selecione o Template</p>
                </div>

                <div class="grid grid-cols-1 gap-3">
                    <button onclick="window.setWizardStep1('📸 Foto de Fachada', 'Tirar foto nítida e frontal da fachada, confirmando se o local está aberto e em operação.')" class="bg-slate-800/50 hover:bg-blue-600 p-4 rounded-2xl border border-white/5 text-left transition-all active:scale-95 group">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl bg-slate-900 p-2 rounded-xl group-hover:bg-blue-700 transition">🏢</span>
                            <div>
                                <p class="text-white font-black text-[11px] uppercase">Fachada e Operação</p>
                                <p class="text-[8px] text-gray-400 group-hover:text-blue-100 uppercase font-bold">Auditoria Visual Rápida</p>
                            </div>
                        </div>
                    </button>

                    <button onclick="window.setWizardStep1('🏷️ Pesquisa de Preço', 'Localizar o item específico e fotografar o preço visível na prateleira/etiqueta.')" class="bg-slate-800/50 hover:bg-emerald-600 p-4 rounded-2xl border border-white/5 text-left transition-all active:scale-95 group">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl bg-slate-900 p-2 rounded-xl group-hover:bg-emerald-700 transition">🏷️</span>
                            <div>
                                <p class="text-white font-black text-[11px] uppercase">Pesquisa de Preço</p>
                                <p class="text-[8px] text-gray-400 group-hover:text-emerald-100 uppercase font-bold">Monitoramento de Mercado</p>
                            </div>
                        </div>
                    </button>

                    <button onclick="window.setWizardStep1('🕒 Status e Promoção', 'Confirmar se há placas de oferta ativa e se o estabelecimento cumpre o horário.')" class="bg-slate-800/50 hover:bg-amber-600 p-4 rounded-2xl border border-white/5 text-left transition-all active:scale-95 group">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl bg-slate-900 p-2 rounded-xl group-hover:bg-amber-700 transition">🕒</span>
                            <div>
                                <p class="text-white font-black text-[11px] uppercase">Status e Promoção</p>
                                <p class="text-[8px] text-gray-400 group-hover:text-amber-100 uppercase font-bold">Check de Campanhas</p>
                            </div>
                        </div>
                    </button>
                </div>

                <button onclick="document.getElementById('modal-editor').classList.add('hidden')" class="w-full py-4 text-gray-600 font-black text-[9px] uppercase tracking-widest hover:text-white transition">Cancelar Encomenda</button>
            </div>
        `;
    };

    // 💾 ARMAZENAMENTO DO PASSO 1
    window.setWizardStep1 = (titulo, descricao) => {
        window.wizardB2BData.title = titulo;
        window.wizardB2BData.description = descricao;
        window.wizardB2BData.b2b_owner_uid = window.auth.currentUser.uid;
        window.wizardB2BData.b2b_name = window.userProfile?.nome || "Empresa B2B";
        
        console.log("📍 Template Selecionado:", titulo);
        window.abrirWizardPasso2(); 
    };

    // 📍 WIZARD B2B: PASSO 2 (LOCALIZAÇÃO E RAIO)
    window.abrirWizardPasso2 = () => {
        const content = document.getElementById('modal-content');
        
        content.innerHTML = `
            <div id="wizard-atlas-step-2" class="space-y-5 animate-fadeIn pb-6">
                <div class="text-center">
                    <h3 class="text-xl font-black text-white uppercase italic tracking-tighter">Passo 2: Onde está o Alvo?</h3>
                    <p class="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Defina o local exato da coleta de dados</p>
                </div>

                <div class="p-4 bg-slate-900/80 rounded-3xl border border-white/5 space-y-4">
                    <div class="relative">
                        <label class="text-[8px] text-gray-500 font-black uppercase ml-2 mb-1 block">Busca Inteligente (Google)</label>
                        <input type="text" id="b2b-address-search" placeholder="Digite o endereço da empresa alvo..." class="w-full p-3 pl-10 rounded-2xl bg-slate-950 text-white text-xs border border-white/10 focus:border-blue-500 outline-none transition">
                        <span class="absolute left-3 top-8 text-gray-500 text-sm">🔍</span>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <label class="text-[8px] text-gray-500 font-black uppercase ml-2 block">Latitude</label>
                            <input id="b2b-lat" readonly class="w-full p-3 rounded-2xl bg-slate-950 text-emerald-400 text-[10px] font-mono border border-white/5 opacity-60" placeholder="0.000000">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] text-gray-500 font-black uppercase ml-2 block">Longitude</label>
                            <input id="b2b-lng" readonly class="w-full p-3 rounded-2xl bg-slate-950 text-emerald-400 text-[10px] font-mono border border-white/5 opacity-60" placeholder="0.000000">
                        </div>
                    </div>

                    <div class="space-y-1">
                        <div class="flex justify-between items-center ml-2">
                            <label class="text-[8px] text-blue-400 font-black uppercase block">Raio de Precisão (Metros)</label>
                            <span id="display-radius" class="text-[10px] text-white font-mono font-bold">500m</span>
                        </div>
                        <input type="range" id="b2b-radius" min="100" max="5000" step="100" value="500" oninput="document.getElementById('display-radius').innerText = this.value + 'm'" class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500">
                        <p class="text-[7px] text-gray-600 italic leading-tight">* Distância máxima que o usuário pode estar para conseguir enviar a foto.</p>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button onclick="window.abrirWizardB2B()" class="flex-1 py-4 bg-slate-800 text-gray-400 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-700 transition">Voltar</button>
                    <button onclick="window.setWizardStep2()" class="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition">Próximo Passo ➜</button>
                </div>
            </div>
        `;

        // Ativa o Autocomplete do Google no campo B2B
        setTimeout(() => {
            if (window.google && window.google.maps) {
                const input = document.getElementById('b2b-address-search');
                const autocomplete = new google.maps.places.Autocomplete(input, {
                    componentRestrictions: { country: "br" },
                    fields: ["geometry", "formatted_address"],
                    types: ["address"]
                });

                autocomplete.addListener("place_changed", () => {
                    const place = autocomplete.getPlace();
                    if (!place.geometry) return;
                    document.getElementById('b2b-lat').value = place.geometry.location.lat().toFixed(6);
                    document.getElementById('b2b-lng').value = place.geometry.location.lng().toFixed(6);
                });
            }
        }, 300);
    };

    // 💾 ARMAZENAMENTO DO PASSO 2
    window.setWizardStep2 = () => {
        const lat = document.getElementById('b2b-lat').value;
        const lng = document.getElementById('b2b-lng').value;
        const radius = document.getElementById('b2b-radius').value;

        if (!lat || !lng) return alert("❌ Por favor, selecione um endereço da lista do Google.");

        window.wizardB2BData.latitude = parseFloat(lat);
        window.wizardB2BData.longitude = parseFloat(lng);
        window.wizardB2BData.radius = parseInt(radius);

       console.log("📍 Localização Definida:", { lat, lng, radius });
        window.abrirWizardPasso3(); 
    };

    // 💰 WIZARD B2B: PASSO 3 (CALCULADORA E MOEDA)
    window.abrirWizardPasso3 = () => {
        const content = document.getElementById('modal-content');
        
        content.innerHTML = `
            <div id="wizard-atlas-step-3" class="space-y-6 animate-fadeIn pb-6">
                <div class="text-center">
                    <h3 class="text-xl font-black text-white uppercase italic tracking-tighter">Passo 3: Investimento</h3>
                    <p class="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Defina a recompensa e a moeda</p>
                </div>

                <div class="p-5 bg-slate-900/80 rounded-3xl border border-white/5 space-y-4">
                    <div>
                        <label class="text-[8px] text-gray-500 font-black uppercase ml-2 mb-1 block">Tipo de Pagamento</label>
                        <select id="b2b-pay-type" onchange="window.atualizarCalculoB2B()" class="w-full p-3 rounded-2xl bg-slate-950 text-white font-bold text-xs border border-white/10 outline-none">
                            <option value="real">💰 DINHEIRO REAL (PIX)</option>
                            <option value="atlix">🪙 CRÉDITOS ATLIX (BÔNUS)</option>
                        </select>
                    </div>

                    <div>
                        <div class="flex justify-between items-center ml-2 mb-1">
                            <div class="flex items-center gap-1">
                                <label class="text-[8px] text-gray-500 font-black uppercase">Valor da Recompensa</label>
                                <button onclick="window.exibirSugestaoPreco()" class="w-4 h-4 flex items-center justify-center rounded-full bg-slate-800 text-blue-400 text-[10px] font-black hover:bg-blue-600 hover:text-white transition">?</button>
                            </div>
                            <span class="text-[7px] text-amber-500 font-bold uppercase tracking-tighter">Piso: R$ 3,00</span>
                        </div>
                        <div class="relative">
                            <span class="absolute left-4 top-4 text-emerald-600 font-black text-xl">R$</span>
                            <input type="number" id="b2b-reward" value="5.00" min="3" step="0.50" oninput="window.atualizarCalculoB2B()" class="w-full p-4 pl-12 rounded-2xl bg-slate-950 text-emerald-400 text-2xl font-black border border-white/10 outline-none focus:border-blue-500 transition">
                        </div>
                    </div>

                    <div id="display-calculo-b2b" class="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-2">
                        <div class="flex justify-between text-[9px] font-bold uppercase">
                            <span class="text-gray-500">Recompensa Usuário:</span>
                            <span id="calc-user" class="text-white">R$ 5,00</span>
                        </div>
                        <div id="row-taxa" class="flex justify-between text-[9px] font-bold uppercase">
                            <span class="text-gray-500">Taxa Inteligência (100%):</span>
                            <span id="calc-taxa" class="text-blue-400">R$ 5,00</span>
                        </div>
                        <div class="h-[1px] bg-white/10 my-1"></div>
                        <div class="flex justify-between text-[11px] font-black uppercase tracking-tight">
                            <span class="text-gray-400">Investimento Total:</span>
                            <span id="calc-total" class="text-emerald-500">R$ 10,00</span>
                        </div>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button onclick="window.abrirWizardPasso2()" class="flex-1 py-4 bg-slate-800 text-gray-400 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-700 transition">Voltar</button>
                    <button onclick="window.setWizardStep3()" class="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition">Revisar Ordem ➜</button>
                </div>
            </div>
        `;
    };

    // 🤖 ROBÔ CALCULADORA EM TEMPO REAL
    window.atualizarCalculoB2B = () => {
        const val = parseFloat(document.getElementById('b2b-reward').value) || 0;
        const type = document.getElementById('b2b-pay-type').value;
        const rowTaxa = document.getElementById('row-taxa');
        
        let taxa = 0;
        if (type === 'real') {
            taxa = val; // Regra: 100% de taxa para Real
            rowTaxa.style.display = 'flex';
        } else {
            taxa = 0; // Regra: Isento de taxa para movimentar ATLIX
            rowTaxa.style.display = 'none';
        }

        const total = val + taxa;

        document.getElementById('calc-user').innerText = `R$ ${val.toFixed(2)}`;
        document.getElementById('calc-taxa').innerText = `R$ ${taxa.toFixed(2)}`;
        document.getElementById('calc-total').innerText = `R$ ${total.toFixed(2)}`;
    };

    // 💾 ARMAZENAMENTO DO PASSO 3
    window.setWizardStep3 = () => {
        const reward = parseFloat(document.getElementById('b2b-reward').value);
        const type = document.getElementById('b2b-pay-type').value;

        // 🛡️ TRAVA DE SEGURANÇA: Piso de R$ 3,00
        if (reward < 3) return alert("⚠️ VALOR INVÁLIDO\n\nO valor mínimo para atrair colaboradores é de R$ 3,00.");

        window.wizardB2BData.reward = reward;
        window.wizardB2BData.pay_type = type;
        window.wizardB2BData.total_with_fee = (type === 'real') ? (reward * 2) : reward;

        console.log("💰 Financeiro Definido:", window.wizardB2BData);
        window.abrirWizardPasso4(); // Vai para o Checkout Final
    };

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
            container.innerHTML += `
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

console.log("🚀 [Missions] Sistema Atlas Vivo 100% Soldado e Visível!");
