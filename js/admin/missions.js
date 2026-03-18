import { collection, getDocs, getDoc, doc, updateDoc, deleteDoc, addDoc, query, orderBy, limit, serverTimestamp, runTransaction, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
let currentTab = 'submissions'; 
let allLoadedMissions = []; // Armazena as missões para edição

export async function init() {
    const container = document.getElementById('view-list');
    
    // 1. Cria a Navegação Interna (Sub-abas)
    const subNav = document.createElement('div');
    subNav.className = "flex gap-4 mb-6 border-b border-slate-800 pb-2";
    subNav.innerHTML = `
        <button onclick="window.switchMissionTab('missions')" id="btn-tab-missions" class="text-gray-400 font-bold uppercase text-xs hover:text-white pb-2 border-b-2 border-transparent transition">📋 Gerenciar Missões</button>
        <button onclick="window.switchMissionTab('submissions')" id="btn-tab-submissions" class="text-blue-500 font-bold uppercase text-xs hover:text-white pb-2 border-b-2 border-blue-500 transition">💰 Analisar Envios</button>
    `;
    
    // Insere antes da tabela se não existir
    if(!document.getElementById('btn-tab-missions')) {
        container.insertBefore(subNav, container.firstChild);
    }

    // Exporta Globais
    window.switchMissionTab = switchMissionTab;
    window.abrirNovaMissao = abrirNovaMissao;
    window.editarMissao = editarMissao; // ✅ Nova Função
    window.salvarMissao = salvarMissao;
    window.excluirMissao = excluirMissao;
    window.aprovarMissao = aprovarMissao;
    window.rejeitarMissao = rejeitarMissao;
    
    // Inicia na aba de Gerenciar (já que você quer editar)
    switchMissionTab('missions');
}

async function switchMissionTab(tab) {
    currentTab = tab;
    const btnMissions = document.getElementById('btn-tab-missions');
    const btnSubs = document.getElementById('btn-tab-submissions');
    const btnAdd = document.getElementById('btn-list-add');
    const header = document.getElementById('list-header');

    if(tab === 'missions') {
        btnMissions.className = "text-blue-500 font-bold uppercase text-xs pb-2 border-b-2 border-blue-500 transition";
        btnSubs.className = "text-gray-400 font-bold uppercase text-xs pb-2 border-b-2 border-transparent transition";
        
        if(btnAdd) { 
            btnAdd.style.display = 'block'; 
           btnAdd.innerHTML = "+ NOVA MISSÃO"; 
            btnAdd.onclick = () => abrirCriadorMissaoAtlas(); // Nome padronizado V2026
        }
        header.innerHTML = `<th class="p-3">TÍTULO</th><th class="p-3">TIPO</th><th class="p-3">VALOR</th><th class="p-3 text-right">AÇÕES</th>`;
        await loadMissionsManagement();
    } else {
        btnMissions.className = "text-gray-400 font-bold uppercase text-xs pb-2 border-b-2 border-transparent transition";
        btnSubs.className = "text-blue-500 font-bold uppercase text-xs pb-2 border-b-2 border-blue-500 transition";
        
        if(btnAdd) { btnAdd.style.display = 'none'; }
        header.innerHTML = `<th class="p-3">MISSÃO</th><th class="p-3">USUÁRIO</th><th class="p-3">PROVA</th><th class="p-3">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        await loadSubmissions();
    }
}

// --- ABA 1: GERENCIAR MISSÕES ---
async function loadMissionsManagement() {
    const tbody = document.getElementById('list-body');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-10"><div class="loader mx-auto border-blue-500"></div></td></tr>`;
    
    try {
        const q = query(collection(window.db, "missions"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        allLoadedMissions = []; // Limpa cache local
        tbody.innerHTML = "";
        
        if(snap.empty) { tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhuma missão ativa. Crie uma!</td></tr>`; return; }

        snap.forEach(d => {
            const m = d.data();
            m.id = d.id; // Guarda ID
            allLoadedMissions.push(m);

            tbody.innerHTML += `
                <tr class="border-b border-slate-800 hover:bg-slate-800/50">
                    <td class="p-3 font-bold text-white">${m.title}</td>
                    <td class="p-3 text-xs uppercase text-gray-400">${m.type || 'Geral'}</td>
                    <td class="p-3 text-emerald-400 font-mono">R$ ${m.reward}</td>
                    <td class="p-3 text-right flex justify-end gap-2">
                        <button onclick="window.editarMissao('${d.id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold transition">✏️ EDITAR</button>
                        <button onclick="window.excluirMissao('${d.id}')" class="text-red-500 hover:text-red-400 font-bold text-xs border border-red-900/50 bg-red-900/20 px-3 py-1 rounded">🗑️</button>
                    </td>
                </tr>
            `;
        });
        document.getElementById('list-count').innerText = `${snap.size} missões ativas`;
    } catch(e) { console.error(e); }
}

// ✅ FUNÇÃO DE PREPARAÇÃO PARA EDIÇÃO
function editarMissao(id) {
    const mission = allLoadedMissions.find(m => m.id === id);
    if(mission) {
        abrirNovaMissao(mission);
    }
}

// 🚀 CRIADOR DE MISSÕES ATLAS V2026.PRO
// Gil, mudamos o nome para abrirCriadorMissaoAtlas para o Core.js te encontrar
async function abrirCriadorMissaoAtlas(dados = null) {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    
    // Configura botão X (com a vacina do core.js isso já deve funcionar, mas reforçamos)
    const btnClose = document.getElementById('btn-close-modal');
    if(btnClose) btnClose.onclick = () => modal.classList.add('hidden');

    content.innerHTML = `
        <div class="space-y-4">
            <h3 class="text-xl font-bold text-white mb-4">${dados ? 'Editar Missão' : 'Nova Micro Tarefa'}</h3>
            <input type="hidden" id="mis-id" value="${dados?.id || ''}">
            
           <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">Título da Missão</label>
                    <input id="mis-title" value="${dados?.title || ''}" class="w-full p-2 rounded bg-white text-black font-bold border border-slate-700" placeholder="Ex: Verificar Fachada">
                </div>
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">ID Vídeo Tutorial (Veo 3)</label>
                    <input id="mis-video-id" value="${dados?.video_id || ''}" class="w-full p-2 rounded bg-white text-black font-mono text-xs border border-slate-700" placeholder="ID do YouTube">
                </div>
            </div>
            
            <div>
                <label class="text-[10px] text-gray-400 font-bold uppercase">Instruções para o Usuário</label>
                <textarea id="mis-desc" class="w-full p-2 rounded bg-white text-black text-sm" rows="2" placeholder="Explique o passo a passo...">${dados?.description || ''}</textarea>
            </div>
            
           <div class="p-4 bg-slate-800 rounded-2xl border border-blue-500/20 space-y-3">
                <div class="flex justify-between items-center">
                    <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest">📍 Localização Atlas Vivo</p>
                    <button onclick="window.obterLocalizacaoAutomatica()" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase transition flex items-center gap-1 shadow-lg">
                        <span class="text-xs">🎯</span> Pegar GPS Atual
                    </button>
                </div>

                <div class="relative group">
                    <input type="text" id="mis-address-search" placeholder="Ou digite o endereço (Rua, Número, Cidade)..." class="w-full p-2.5 pl-9 rounded-xl bg-slate-900 text-white text-xs border border-slate-700 focus:border-blue-500 outline-none transition">
                    <span class="absolute left-3 top-2.5 text-gray-500">🔍</span>
                    <button onclick="window.converterEnderecoEmGps()" class="absolute right-2 top-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg text-[8px] font-bold uppercase transition">Converter</button>
                </div>

                <div class="grid grid-cols-3 gap-2">
                    <div class="space-y-1">
                        <label class="text-[8px] text-gray-500 font-bold uppercase ml-1">Latitude</label>
                        <input id="mis-lat" value="${dados?.latitude || ''}" class="w-full p-2 rounded-lg bg-slate-950 text-emerald-400 text-[10px] font-mono border border-slate-800" placeholder="0.0000">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[8px] text-gray-500 font-bold uppercase ml-1">Longitude</label>
                        <input id="mis-lng" value="${dados?.longitude || ''}" class="w-full p-2 rounded-lg bg-slate-950 text-emerald-400 text-[10px] font-mono border border-slate-800" placeholder="0.0000">
                    </div>
                   <div class="space-y-1">
                        <label class="text-[8px] text-blue-400 font-bold uppercase ml-1">Distância Máxima (Ex: 5000 para 5km)</label>
                        <input id="mis-radius" value="${dados?.radius || 500}" type="number" class="w-full p-2 rounded-lg bg-slate-950 text-white text-[10px] font-mono border border-slate-800" placeholder="Ex: 1000">
                    </div>
                </div>
                <p class="text-[8px] text-gray-500 italic">* Se for missão online (sem local fixo), deixe Latitude e Longitude vazios.</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">Valor da Recompensa</label>
                    <input type="number" id="mis-reward" value="${dados?.reward || ''}" class="w-full p-2 rounded bg-white text-black font-black text-green-700" placeholder="0.00">
                </div>
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">Tipo de Pagamento</label>
                    <select id="mis-pay-type" class="w-full p-2 rounded bg-white text-black font-bold">
                        <option value="atlix" ${dados?.pay_type === 'atlix' ? 'selected' : ''}>🪙 ATLIX (Bônus)</option>
                        <option value="real" ${dados?.pay_type === 'real' ? 'selected' : ''}>💰 REAL (Dinheiro)</option>
                    </select>
                </div>
            </div>
            
            <button onclick="window.salvarMissao()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold uppercase shadow-lg transition transform active:scale-95">
                ${dados ? '💾 SALVAR ALTERAÇÕES' : '🚀 CRIAR MISSÃO'}
            </button>
       </div>
    `;

    // 🛰️ DESPERTADOR GOOGLE V2026: Liga o sensor 200ms após o modal abrir para garantir que o HTML exista
    setTimeout(() => {
        if (window.iniciarAutocompleteMissions) window.iniciarAutocompleteMissions();
    }, 200);
}

async function salvarMissao() {
    // Captura de IDs e Valores do Novo Formulário
    const id = document.getElementById('mis-id').value;
    const title = document.getElementById('mis-title').value;
    const desc = document.getElementById('mis-desc').value;
    const reward = document.getElementById('mis-reward').value;
    const videoId = document.getElementById('mis-video-id').value;
    
    // Captura Atlas Vivo
    const lat = document.getElementById('mis-lat').value;
    const lng = document.getElementById('mis-lng').value;
    const radius = document.getElementById('mis-radius').value;
    
    // Captura Moeda
    const payType = document.getElementById('mis-pay-type').value;

    if(!title || !reward) return alert("Erro: Título e Valor são obrigatórios.");

    // 🏗️ PAYLOAD V2026: Estrutura preparada para escala de milhões de usuários
    const payload = {
        title, 
        description: desc, 
        reward: parseFloat(reward), 
        video_id: videoId || null,
       latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
        // Gil, garantimos que o raio seja lido como número inteiro puro (Metros)
        radius: radius ? Number(radius) : 50,
        pay_type: payType, // Define se paga em ATLIX ou REAL
        updated_at: serverTimestamp(), 
        active: true
    };

    try {
        if (id) {
            // EDITAR
            await updateDoc(doc(window.db, "missions", id), payload);
            alert("✅ Missão atualizada!");
        } else {
            // CRIAR
            payload.created_at = serverTimestamp();
            await addDoc(collection(window.db, "missions"), payload);
            alert("✅ Missão criada!");
        }
        
        document.getElementById('modal-editor').classList.add('hidden');
        loadMissionsManagement();
    } catch(e) { alert(e.message); }
}

async function excluirMissao(id) {
    if(confirm("Excluir esta missão?")) {
        await deleteDoc(doc(window.db, "missions", id));
        loadMissionsManagement();
    }
}

// --- ABA 2: ANALISAR ENVIOS (MANTIDO) ---
async function loadSubmissions() {
    const tbody = document.getElementById('list-body');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader mx-auto border-blue-500"></div></td></tr>`;

    try {
        const q = query(collection(window.db, "mission_submissions"), orderBy("created_at", "desc"), limit(50));
        const snap = await getDocs(q);
        tbody.innerHTML = "";

        if(snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-500">Nenhum envio para analisar.</td></tr>`;
            document.getElementById('list-count').innerText = "0 envios";
            return;
        }

        document.getElementById('list-count').innerText = `${snap.size} envios`;

        snap.forEach(d => {
            const data = d.data();
            let statusBadge = `<span class="bg-yellow-900 text-yellow-400 px-2 py-1 rounded text-[9px] uppercase border border-yellow-700">⏳ PENDENTE</span>`;
            if(data.status === 'approved') statusBadge = `<span class="bg-green-900 text-green-400 px-2 py-1 rounded text-[9px] uppercase border border-green-700">✅ PAGO</span>`;
            if(data.status === 'rejected') statusBadge = `<span class="bg-red-900 text-red-400 px-2 py-1 rounded text-[9px] uppercase border border-red-700">❌ RECUSADO</span>`;

            let provaLink = '<span class="text-gray-600 text-xs">Sem anexo</span>';
            if(data.proof_url || data.photo_url) {
                provaLink = `<a href="${data.proof_url || data.photo_url}" target="_blank" class="text-blue-400 hover:text-blue-300 text-xs underline flex items-center gap-1">👁️ Ver Prova</a>`;
            }

            tbody.innerHTML += `
                <tr class="border-b border-slate-800 hover:bg-slate-800/50">
                    <td class="p-3 text-white font-bold text-sm">${data.mission_title || 'Missão'}</td>
                    <td class="p-3 text-gray-400 text-xs">${data.user_name || data.user_email || 'Usuário'}</td>
                    <td class="p-3">${provaLink}</td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3 text-right">
                        ${data.status === 'pending' ? `
                            <button onclick="window.aprovarMissao('${d.id}', '${data.user_id}', ${data.reward || 0})" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-[10px] font-bold mr-2 shadow">PAGAR R$ ${data.reward}</button>
                            <button onclick="window.rejeitarMissao('${d.id}')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-[10px] font-bold shadow">RECUSAR</button>
                        ` : '<span class="text-gray-600 text-[10px]">Processado</span>'}
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error(e); }
}

// 💰 V2026.PRO: Motor de Aprovação Híbrido (ATLIX Automático vs REAL na Fila)
async function aprovarMissao(docId, userId, valor) {
    // Primeiro, recuperamos os dados da submissão para saber o pay_type
    try {
        const subSnap = await getDoc(doc(window.db, "mission_submissions", docId));
        if (!subSnap.exists()) return alert("Erro: Envio não encontrado.");
        const subData = subSnap.data();
        const tipoMoeda = subData.pay_type || 'atlix'; // Padrão é ATLIX se estiver vazio

        if(!confirm(`Aprovar missão de R$ ${valor} (${tipoMoeda.toUpperCase()})?`)) return;

        if (tipoMoeda === 'atlix') {
            // --- FLUXO A: PAGAMENTO AUTOMÁTICO EM ATLIX ---
            await updateDoc(doc(window.db, "mission_submissions", docId), { 
                status: 'approved', 
                paid_at: serverTimestamp() 
            });

            if (window.receberRecompensaMissao) {
                await window.receberRecompensaMissao(valor, subData.mission_title || "Missão Concluída");
            }

            await addDoc(collection(window.db, "notifications"), {
                uid: userId, 
                message: `💰 Missão Aprovada! R$ ${valor} em bônus ATLIX creditados.`, 
                read: false, type: 'success', created_at: serverTimestamp()
            });
            alert("✅ Pago automaticamente em ATLIX!");

        } else {
            // --- FLUXO B: PAGAMENTO EM REAL (VAI PARA A FILA DO DASHBOARD) ---
            // Mudamos o status para um específico que o Dashboard/Assistant vai vigiar
            await updateDoc(doc(window.db, "mission_submissions", docId), { 
                status: 'approved_pending_pix', 
                approved_at: serverTimestamp() 
            });

            // Notifica o usuário que foi aprovado, mas o PIX está sendo processado
            await addDoc(collection(window.db, "notifications"), {
                uid: userId, 
                message: `✅ Sua missão de R$ ${valor} foi aprovada! O pagamento via PIX será realizado em breve.`, 
                read: false, type: 'info', created_at: serverTimestamp()
            });
            alert("⚠️ Aprovada! O pagamento em REAL foi enviado para sua fila de PIX no Dashboard.");
        }

        loadSubmissions(); // Atualiza a tabela do Admin

    } catch(e) {
        console.error("Erro na Aprovação:", e);
        alert("❌ Falha técnica: " + e.message);
    }
}

async function rejeitarMissao(docId) {
    if(!confirm("Rejeitar esta missão?")) return;
    await updateDoc(doc(window.db, "mission_submissions", docId), { status: 'rejected' });
    loadSubmissions();
}

// 🚀 MOTOR AUTOCOMPLETE GOOGLE V2026
// Gil, esta função liga as sugestões inteligentes do Google ao seu campo de busca
window.iniciarAutocompleteMissions = () => {
    const input = document.getElementById('mis-address-search');
    // Verifica se o input existe e se o script do Google no admin.html carregou
    if (!input || !window.google) return console.warn("🛰️ Google Maps SDK não detectado ou campo ausente.");

    // Configura o Autocomplete focado em endereços brasileiros
    const options = {
        componentRestrictions: { country: "br" },
        fields: ["geometry", "formatted_address"],
        types: ["address"]
    };

    const auto = new google.maps.places.Autocomplete(input, options);

    // 🎯 O GOLPE DE MESTRE: Quando você clica na sugestão, ele preenche os números sozinho!
    auto.addListener("place_changed", () => {
        const place = auto.getPlace();
        if (!place.geometry || !place.geometry.location) {
            return alert("Local não encontrado. Selecione uma opção da lista sugestiva.");
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        // Alimenta os campos de coordenadas automaticamente
        document.getElementById('mis-lat').value = lat.toFixed(6);
        document.getElementById('mis-lng').value = lng.toFixed(6);
        
        console.log("📍 Endereço Geocodificado:", place.formatted_address);
    });
};

// 📡 MOTOR DE GEOLOCALIZAÇÃO FÍSICA
// Pega a sua posição exata pelo GPS do seu notebook ou celular atual
window.obterLocalizacaoAutomatica = () => {
    if (!navigator.geolocation) return alert("Seu navegador não tem sensor de GPS.");
    
    const btn = event.currentTarget;
    btn.innerText = "🛰️ BUSCANDO...";

    navigator.geolocation.getCurrentPosition((pos) => {
        document.getElementById('mis-lat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('mis-lng').value = pos.coords.longitude.toFixed(6);
        btn.innerText = "✅ LOCALIZADO";
        setTimeout(() => { btn.innerText = "🎯 PEGAR GPS ATUAL"; }, 2000);
    }, (err) => {
        alert("Erro no GPS: " + err.message);
        btn.innerText = "🎯 PEGAR GPS ATUAL";
    }, { enableHighAccuracy: true });
};

// 💡 PONTE DE AUXÍLIO
window.converterEnderecoEmGps = () => {
    alert("💡 Dica do Maestro: Basta digitar o endereço no campo de busca acima e clicar na sugestão que aparecer!");
};

// 🔐 SOLDAGEM GLOBAL ADMIN V2026.PRO (FINAL)
window.abrirCriadorMissaoAtlas = abrirCriadorMissaoAtlas;
window.abrirNovaMissao = abrirCriadorMissaoAtlas; 
window.obterLocalizacaoAutomatica = obterLocalizacaoAutomatica;
window.converterEnderecoEmGps = converterEnderecoEmGps;

console.log("🚀 [Missions Admin] Sistema Atlas Vivo com Inteligência Google Soldado!");
