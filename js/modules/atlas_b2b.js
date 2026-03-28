import { db, auth } from '../config.js';
import { collection, getDocs, getDoc, doc, query, where, addDoc, serverTimestamp, orderBy, runTransaction, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🏢 MOTOR DE INTERFACE EXCLUSIVA B2B - ATLIVIO V2026
// Este motor gerencia a criação e auditoria de ordens estratégicas.
export async function initB2B() {
   const container = document.getElementById('sec-b2b_gestao');
    if (!container) return;

    console.log("💼 Atlas B2B: Ativando Central de Inteligência Estratégica.");

    container.innerHTML = `
        <div class="p-4 space-y-6 animate-fadeIn pb-24">
            <div class="flex justify-between items-end">
                <div>
                    <h2 class="text-2xl font-black text-blue-900 uppercase italic tracking-tighter leading-none">Gestão Atlas</h2>
                    <p class="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">Inteligência Estratégica B2B</p>
                </div>
                <div class="flex gap-1 bg-slate-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                    <button onclick="window.alternarSubAbaB2B('radar')" id="btn-sub-radar" class="px-4 py-2 rounded-lg text-[9px] font-black uppercase transition bg-blue-600 text-white shadow-md">📡 Minhas Ordens</button>
                    <button onclick="window.alternarSubAbaB2B('auditoria')" id="btn-sub-auditoria" class="px-4 py-2 rounded-lg text-[9px] font-black uppercase transition text-gray-400">⚖️ Auditoria</button>
                </div>
            </div>
            
            <div id="sub-view-container" class="min-h-[400px] space-y-4">
                <div id="lista-cards-b2b-real"></div>
            </div>

            <button onclick="window.abrirWizardB2B()" class="fixed bottom-24 right-6 z-[100] bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-full shadow-2xl transition-all active:scale-95 border-2 border-white/20 animate-bounce">
                <span class="text-2xl">💼</span>
            </button>
        </div>
    `;
    
    // Inicia carregando as ordens já criadas
    window.carregarOrdensB2B();
}

// 🔄 MOTOR DE ALTERNÂNCIA B2B
window.alternarSubAbaB2B = (aba) => {
    const btnRadar = document.getElementById('btn-sub-radar');
    const btnAudit = document.getElementById('btn-sub-auditoria');
    const container = document.getElementById('sub-view-container');

    if(aba === 'radar') {
        btnRadar.className = "px-4 py-2 rounded-lg text-[9px] font-black uppercase transition bg-blue-600 text-white shadow-md";
        btnAudit.className = "px-4 py-2 rounded-lg text-[9px] font-black uppercase transition text-gray-400";
        window.carregarOrdensB2B(); 
    } else {
        btnRadar.className = "px-4 py-2 rounded-lg text-[9px] font-black uppercase transition text-gray-400";
        btnAudit.className = "px-4 py-2 rounded-lg text-[9px] font-black uppercase transition bg-blue-600 text-white shadow-md";
        window.carregarAuditoriaB2B(); 
    }
};

// 🛰️ CARREGADOR DE ORDENS DO CLIENTE
window.carregarOrdensB2B = async () => {
    const lista = document.getElementById('lista-cards-b2b-real') || document.getElementById('sub-view-container');
    lista.innerHTML = `<div class="py-20 text-center"><div class="loader mx-auto border-blue-500"></div></div>`;

    try {
        // 🛰️ Busca otimizada: Procura missões onde o usuário é o dono (owner_id)
        const q = query(
            collection(db, "missions"), 
            where("owner_id", "==", auth.currentUser.uid),
            orderBy("created_at", "desc")
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            lista.innerHTML = `<p class="text-center py-20 text-gray-400 text-xs italic uppercase">Você ainda não enviou ordens de coleta.</p>`;
            return;
        }

        lista.innerHTML = "";
       snap.forEach(doc => {
            const m = doc.data();
            // 🚥 LOGICA DE CORES ATLIVIO V2026
            let statusColor = 'text-amber-500';
            let statusTexto = '⏳ Aguardando...';
            let alertMsg = '';

            // Substituiremos a lógica de decisão por esta:
if (m.status === 'active') {
    statusColor = 'text-emerald-500';
    statusTexto = '● Ativa no Radar';
} else if (m.status === 'rejected') {
    statusColor = 'text-red-500';
    statusTexto = '❌ Ordem Rejeitada'; // <--- Isso resolve o seu print!
} else if (m.status === 'pending_b2b') {
    statusColor = 'text-amber-500';
    statusTexto = '⏳ Em Análise';
} else {
    statusColor = 'text-gray-400';
    statusTexto = 'Finalizada';
}

            lista.innerHTML += `
                <div class="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
                    <div class="flex justify-between items-start">
                        <span class="text-[7px] font-black bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase tracking-widest">ID: ${doc.id.slice(0,8)}</span>
                        <span class="text-[8px] font-black uppercase ${statusColor}">${statusTexto}</span>
                    </div>
                    <h4 class="text-blue-900 font-black uppercase text-xs">${m.title}</h4>
                    <p class="text-[9px] text-gray-400 leading-tight">${m.description}</p>
                    ${alertMsg}
                    <h4 class="text-blue-900 font-black uppercase text-xs">${m.title}</h4>
                    <p class="text-[9px] text-gray-400 leading-tight">${m.description}</p>
                    <div class="flex justify-between items-center pt-2 border-t border-gray-50 gap-2">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-bold text-emerald-600">R$ ${m.reward.toFixed(2)}</span>
                            <span class="text-[7px] font-black text-gray-400 uppercase">${m.pay_type === 'real' ? 'Dinheiro' : 'Atlix'}</span>
                        </div>
                       ${(m.status === 'active' || m.status === 'pending_b2b') ? `
                            <button onclick="window.encerrarMissaoB2BComEstorno('${doc.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all border border-red-100">
                                ⛔ Encerrar e Reembolsar
                            </button>
                        ` : `
                            <span class="text-[8px] font-black text-gray-300 uppercase italic">Fluxo Finalizado</span>
                        `}
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
};

// ⚖️ MOTOR DE AUDITORIA B2B (EXCLUSIVO)
window.carregarAuditoriaB2B = async () => {
    const container = document.getElementById('sub-view-container');
    container.innerHTML = `<div class="py-20 text-center"><div class="loader mx-auto border-amber-500"></div></div>`;

   try {
     // ⚖️ Busca unificada: Filtramos pelo UID do dono B2B para garantir que ele só veja as provas das próprias missões
        const q = query(
            collection(db, "mission_submissions"),
            where("b2b_owner_uid", "==", auth.currentUser.uid), // ──▶ Usando b2b_owner_uid para match com a liquidação
            where("status", "==", "pending"), // ──▶ Somente o que ainda não foi auditado
            orderBy("created_at", "desc") // ──▶ Exibe as submissões mais recentes primeiro
        );
        const snap = await getDocs(q);

        // 🛡️ Trava de Segurança Atlivio: Evita erro se a coleção sumir ou estiver vazia
        if (!snap || snap.empty) {
            container.innerHTML = `
                <div class="py-20 text-center space-y-3">
                    <div class="text-4xl opacity-20">📡</div>
                    <p class="text-gray-400 text-[10px] font-black uppercase tracking-widest">Radar de Auditoria Limpo</p>
                    <p class="text-gray-500 text-[8px] italic">Nenhuma prova pendente para suas missões no momento.</p>
                </div>`;
            return;
        }

        container.innerHTML = `<div class="grid gap-4" id="lista-auditoria-cards"></div>`;
        snap.forEach(d => {
            const m = d.data();
            // 🛡️ Trava de Segurança: Ignora se a submissão não pertencer a este B2B (Double Check)
            if (m.b2b_owner_uid !== auth.currentUser.uid) return;
            document.getElementById('lista-auditoria-cards').innerHTML += `
                <div class="bg-white p-5 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4">
                    <div class="flex justify-between items-center">
                        <h4 class="text-blue-900 font-black text-xs uppercase">${m.mission_title}</h4>
                        <span class="text-[7px] font-black uppercase px-2 py-1 rounded-full ${m.gps_status === 'match' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
                            ${m.gps_status === 'match' ? 'GPS OK' : 'GPS SUSPEITO'}
                        </span>
                    </div>
                    <img src="${m.proof_url}" class="w-full h-48 object-cover rounded-[2rem] border border-gray-100">
                    <div class="flex gap-2">
                        <button onclick="window.vereditoB2B('${d.id}', 'rejected')" class="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-[9px] uppercase">Reprovar</button>
                        <button onclick="window.vereditoB2B('${d.id}', 'approved')" class="flex-[2] py-3 bg-blue-600 text-white rounded-2xl font-black text-[9px] uppercase shadow-lg shadow-blue-200">Aprovar e Pagar</button>
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
};

// 🏛️ DECISÃO DO CLIENTE (PAGAMENTO OU DISPUTA)
/**
 * ⚖️ VEREDITO DO CLIENTE B2B (COM CHAVE DE AUTONOMIA)
 * Decide se o pagamento sai na hora ou se cai na fila do Admin.
 */
window.vereditoB2B = async (docId, status) => {
    const acao = status === 'approved' ? 'APROVAR' : 'REPROVAR';
    if(!confirm(`Confirma ${acao}?`)) return;

    try {
        const { getDoc, doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        // 🧠 Consulta a Regra Soberana do Admin (Banco Central)
        const ecoSnap = await getDoc(doc(db, "settings", "global_economy"));
        const podePagarDireto = ecoSnap.exists() ? ecoSnap.data().aprovacao_automatica_b2b : false;

        if (status === 'approved') {
            if (podePagarDireto) {
                // 🚀 MODO AUTÔNOMO: Paga o usuário agora e encerra o processo
                await window.liquidarPagamentoB2B(docId);
                alert("✅ APROVADO: O saldo foi transferido ao usuário e sua taxa foi liquidada.");
           } else {
                // ⏳ MODO MANUAL: Verificação de segurança adicional ativada no Banco Central
                await updateDoc(doc(db, "mission_submissions", docId), {
                    status: 'approved_by_b2b',
                    status_history: 'Aguardando validação do sistema central',
                    reviewed_at: serverTimestamp()
                });
                alert("✔️ APROVAÇÃO REGISTRADA: O pagamento passará pela validação final do sistema Atlivio para ser liberado.");
            }
        } else {
            // ⚖️ DISPUTA: Se o B2B reprovar, sempre cai na sua mão para evitar golpe da empresa
            await updateDoc(doc(db, "mission_submissions", docId), {
                status: 'b2b_rejected',
                status_history: 'Aguardando auditoria de disputa',
                reviewed_at: serverTimestamp()
            });
            alert("⚖️ DISPUTA ABERTA: O Admin analisará a evidência para dar o veredito final.");
        }
        
        window.carregarAuditoriaB2B();
   } catch (e) { alert("Erro ao processar veredito."); }
};

// 💎 MOTOR DE LIQUIDAÇÃO ATLIVIO: Transfere o valor reservado para o executor
window.liquidarPagamentoB2B = async (submissionId) => {
    try {
        const subRef = doc(db, "mission_submissions", submissionId);
        const subSnap = await getDoc(subRef);
        const data = subSnap.data();

        // 🛡️ Segurança: Verifica se existe saldo reservado e dados do dono
        if (!data.b2b_owner_uid || !data.reward) throw "Dados financeiros incompletos.";

        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "usuarios", data.user_id); // Executor da missão
            const b2bRef = doc(db, "usuarios", data.b2b_owner_uid); // Cliente que paga

           // 1. REGRA DO ABATE: Remove o valor total (Missão + Taxa) da reserva do B2B
            // O valorUnitarioComTaxa deve vir da missão para garantir o lucro da Atlivio
            const valorDebitoTotal = data.unit_total_with_fee || data.reward; 
            transaction.update(b2bRef, { 
                wallet_reserved: increment(-valorDebitoTotal),
                updated_at: serverTimestamp()
            });

            // 2. REGRA DO CRÉDITO: O prestador recebe o valor líquido em sua carteira de trabalho
            transaction.update(userRef, { 
                wallet_balance: increment(data.reward),
                updated_at: serverTimestamp()
            });

            // 3. REGRA DA TAXA (LIMPEZA): Só grava se o lucro for real e o destino for 'stats'
            // Gil, calculamos o lucro garantindo que ele não seja o valor total da missão por erro de campo
            const lucroRealAtlivio = Number(valorDebitoTotal) - Number(data.reward);
            
            // Trava: se o lucro calculado for igual à recompensa, significa que o valor total não foi lido. 
            // Não gravamos nada para não sujar o banco com os 5,00 do prestador.
            if (lucroRealAtlivio > 0 && lucroRealAtlivio < valorDebitoTotal) {
                const statsRef = doc(db, "sys_finance", "stats");
                transaction.update(statsRef, { 
                    total_revenue: increment(lucroRealAtlivio),
                    ultima_atualizacao: serverTimestamp()
                });
                console.log("📈 Sucesso: Taxa de " + lucroRealAtlivio + " enviada para STATS.");
            } else {
                console.warn("⚠️ Alerta: Lucro inválido ou não detectado. Gravação em STATS abortada.");
            }

            // 4. FINALIZAÇÃO: Marca como pago via Crédito Atlix no banco
            transaction.update(subRef, { 
                status: 'paid_atlix', 
                paid_at: serverTimestamp(),
                taxa_atlivio_liquidada: lucroAtlivio
            });
        });

        alert("✅ PAGAMENTO PROCESSADO: O saldo foi transferido com sucesso.");
    } catch (err) {
        console.error("Erro na liquidação:", err);
        alert("Erro ao processar transferência de valores.");
    }
};

// 🪄 WIZARD ATLAS B2B: MOTOR DE CRIAÇÃO PASSO A PASSO
window.wizardB2BData = {}; // Memória temporária da missão

window.abrirWizardB2B = () => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    
    // 🎨 DESIGN PREMIUM B2B: Fundo radial, Título Laranja Forte e Subtítulo Cyan Neon
    content.innerHTML = `
        <style>
            /* Define o fundo com profundidade industrial */
            #modal-editor { background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%) !important; }
            
            .input-b2b-lapidado {
                background-color: #0f172a !important; /* Fundo escuro para contraste */
                border: 2px solid #334155 !important; /* Borda discreta inicial */
                color: #f8fafc !important;
                border-radius: 1rem !important;
                padding: 1rem !important;
                width: 100% !important;
                outline: none !important;
                margin-bottom: 1.5rem !important;
                font-size: 14px !important;
                transition: all 0.3s ease;
            }
            /* O input "acende" em Cyan quando o usuário clica para digitar */
            .input-b2b-lapidado:focus {
                border-color: #22d3ee !important;
                box-shadow: 0 0 15px rgba(34, 211, 238, 0.3) !important;
                background-color: #111a2e !important;
            }
        </style>

        <div class="max-w-[450px] mx-auto animate-fadeIn pb-6">
            <div class="text-center mb-8">
                <h3 class="text-[28px] font-black text-orange-400 uppercase italic tracking-tighter leading-tight" style="text-shadow: 0 2px 10px rgba(251, 146, 60, 0.3);">
                    Passo 1: Briefing
                </h3>
                <p class="text-[10px] text-cyan-400 font-black uppercase tracking-[0.15em] mt-1">
                    Configuração de Missão Atlas
                </p>
            </div>
            
            <div class="flex flex-col">
                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3 mb-2">Título da Ordem</label>
                <input type="text" id="b2b-title" placeholder="Ex: Auditoria de Estoque - Loja Centro" class="input-b2b-lapidado font-bold">
                
                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3 mb-2">Instruções de Coleta</label>
                <textarea id="b2b-desc" rows="4" placeholder="Descreva exatamente o que o prestador deve fotografar..." class="input-b2b-lapidado text-sm"></textarea>
            </div>

            <button onclick="window.proximoPassoWizard(2)" class="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-black text-[11px] uppercase shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] active:scale-95 transition-all">
                Continuar para Localização ➜
            </button>
        </div>
    `;
};

window.proximoPassoWizard = (passo) => {
    if (passo === 2) {
        const title = document.getElementById('b2b-title').value;
        const desc = document.getElementById('b2b-desc').value;
        if (!title || !desc) return alert("Preencha o título e a descrição!");

       window.wizardB2BData.title = title;
        window.wizardB2BData.description = desc;
        // 🆔 DNA UNIFICADO: Salvando como owner_id para compatibilidade com o motor de estorno
        window.wizardB2BData.owner_id = auth.currentUser.uid;

      // PASSO 2: LOCALIZAÇÃO - Sincronizado com a nova identidade Premium e Fundo Radial
        document.getElementById('modal-content').innerHTML = `
            <style>
                /* Garante que o Passo 2 herde o fundo com profundidade industrial da ATLIVIO */
                #modal-editor { background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%) !important; }
            </style>

            <div class="max-w-[450px] mx-auto animate-fadeIn space-y-6 text-center">
                <div class="mb-8">
                    <h3 class="text-[28px] font-black text-orange-400 uppercase italic tracking-tighter leading-tight" style="text-shadow: 0 2px 10px rgba(251, 146, 60, 0.3);">Passo 2: Localização</h3>
                    <p class="text-[10px] text-cyan-400 font-black uppercase tracking-[0.15em] mt-1">Centro Geográfico da Missão</p>
                </div>

               <div class="p-5 bg-slate-900/60 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-4">
                    <div class="flex justify-between items-center px-2">
                        <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest">📍 Ponto de Captura</p>
                        <button onclick="window.obterLocalizacaoAutomatica()" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition flex items-center gap-1 shadow-lg">
                            🎯 GPS ATUAL
                        </button>
                    </div>

                    <div class="relative group">
                        <input type="text" id="mis-address-search" placeholder="Busque por endereço, rua ou cidade..." class="w-full p-3 pl-10 rounded-xl bg-black text-white text-xs border border-white/10 focus:border-cyan-500 outline-none transition-all">
                        <span class="absolute left-3 top-3 text-gray-500">🔍</span>
                    </div>

                    <div class="grid grid-cols-3 gap-2">
                        <div class="space-y-1 text-left">
                            <label class="text-[8px] text-gray-500 font-black uppercase ml-1">Latitude</label>
                            <input id="b2b-lat" readonly class="w-full p-2 rounded-lg bg-slate-950 text-emerald-400 text-[10px] font-mono border border-white/5" placeholder="0.0000">
                        </div>
                        <div class="space-y-1 text-left">
                            <label class="text-[8px] text-gray-500 font-black uppercase ml-1">Longitude</label>
                            <input id="b2b-lng" readonly class="w-full p-2 rounded-lg bg-slate-950 text-emerald-400 text-[10px] font-mono border border-white/5" placeholder="0.0000">
                        </div>
                        <div class="space-y-1 text-left">
                            <label class="text-[8px] text-cyan-400 font-black uppercase ml-1">Raio (Metros)</label>
                            <input id="b2b-radius" type="number" value="500" oninput="window.validarRaioB2B(this)" class="w-full p-2 rounded-lg bg-slate-950 text-white text-[10px] font-mono border border-white/5 focus:border-cyan-500 outline-none" placeholder="Ex: 500">
                        </div>
                    </div>
                    <p class="text-[8px] text-gray-500 italic px-2">* Missão Online? Deixe Latitude/Longitude vazios e Raio em 0.</p>
                </div>

                <button id="btn-next-3" disabled onclick="window.finalizarLocalWizard()" class="w-full py-5 bg-slate-800 text-gray-600 rounded-2xl font-black text-[11px] uppercase cursor-not-allowed border border-white/5 transition-all shadow-md">
                    Definir Investimento ➜
                </button>
            </div>
        `;
        // 🛰️ DESPERTADOR GOOGLE: Ativa a busca de endereços 200ms após o HTML carregar
       // 🛰️ DESPERTADOR GOOGLE: Ativa a busca de endereços 200ms após o HTML carregar
        setTimeout(() => { if(window.iniciarAutocompleteB2B) window.iniciarAutocompleteB2B(); }, 200);
    }
};

// 📡 MOTOR DE CAPTURA SATELITAL: Pega a posição real do dispositivo do Cliente
window.obterLocalizacaoAutomatica = () => {
    if (!navigator.geolocation) return alert("Seu navegador não possui sensores de GPS.");
    
    // Feedback visual imediato no botão
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ SINCRONIZANDO...";
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition((pos) => {
        // Grava as coordenadas com precisão de 6 casas decimais (Padrão Militar)
        document.getElementById('b2b-lat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('b2b-lng').value = pos.coords.longitude.toFixed(6);
        
        btn.innerHTML = "✅ LOCALIZADO";
        btn.classList.replace('bg-blue-600', 'bg-emerald-600');
        
        // Libera o avanço para o Passo 3
        window.liberarBotaoInvestimento();
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.replace('bg-emerald-600', 'bg-blue-600');
            btn.disabled = false;
        }, 3000);
    }, (err) => {
        alert("🚩 Falha no Satélite: Certifique-se de que o GPS está ativado e o navegador tem permissão.");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }, { enableHighAccuracy: true });
};

// 🚀 MOTOR AUTOCOMPLETE GOOGLE V2026: Inteligência de Geocodificação ATLIVIO
window.iniciarAutocompleteB2B = () => {
    const input = document.getElementById('mis-address-search');
    
    // 🛡️ Segurança: Verifica se o Google SDK e o campo existem na tela
    if (!input || !window.google) {
        return console.warn("🛰️ Atlas B2B: Google Maps SDK não detectado.");
    }

    // Configura o Autocomplete focado 100% em endereços reais no Brasil
    const options = {
        componentRestrictions: { country: "br" },
        fields: ["geometry", "formatted_address"],
        types: ["address"]
    };

    const auto = new google.maps.places.Autocomplete(input, options);

    // 🎯 O GOLPE DE MESTRE: Transforma a seleção do endereço em coordenadas precisas
    auto.addListener("place_changed", () => {
        const place = auto.getPlace();
        
        if (!place.geometry || !place.geometry.location) {
            return alert("📍 Local não identificado. Selecione uma opção da lista sugerida!");
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        // Alimenta os sensores invisíveis do formulário
        document.getElementById('b2b-lat').value = lat.toFixed(6);
        document.getElementById('b2b-lng').value = lng.toFixed(6);
        
        console.log("✅ Geocodificação Concluída:", place.formatted_address);
        
        // Destrava o fluxo para o próximo passo (Investimento)
        window.liberarBotaoInvestimento();
    });
};

window.validarRaioB2B = (input) => { if(input.value < 0) input.value = 0; window.liberarBotaoInvestimento(); };

window.liberarBotaoInvestimento = () => {
    const btn = document.getElementById('btn-next-3');
    if(btn) { btn.disabled = false; btn.className = "w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-lg active:scale-95 transition-all"; }
};

// 💰 PASSO 3: INVESTIMENTO - Finalização com a identidade visual da ATLIVIO
window.finalizarLocalWizard = () => {
    // 💣 OPERAÇÃO GHOST: Destrói o container do Google para limpar a linha lixo no Passo 3
    document.querySelectorAll('.pac-container').forEach(el => el.remove());

    const latStr = document.getElementById('b2b-lat').value;
    const lngStr = document.getElementById('b2b-lng').value;
    const radStr = document.getElementById('b2b-radius').value;

    window.wizardB2BData.latitude = latStr ? parseFloat(latStr) : null;
    window.wizardB2BData.longitude = lngStr ? parseFloat(lngStr) : null;
    window.wizardB2BData.radius = radStr ? Number(radStr) : 0;

    const content = document.getElementById('modal-content');
    content.innerHTML = `
        <style>
            /* Gil, forçamos o fundo radial também no Passo 3 para manter a alma da ATLIVIO acesa */
            #modal-editor { background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%) !important; }
        </style>

        <div class="max-w-[450px] mx-auto animate-fadeIn space-y-8">
            <div class="text-center">
                <h3 class="text-[28px] font-black text-orange-400 uppercase italic tracking-tighter leading-tight" style="text-shadow: 0 2px 10px rgba(251, 146, 60, 0.3);">Passo 3: Investimento</h3>
                <p class="text-[10px] text-cyan-400 font-black uppercase tracking-[0.15em] mt-1">Custo de Aquisição de Dados</p>
            </div>

           <div class="p-6 bg-slate-900/60 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-4">
              <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Valor por Foto (AX)</label>
                        <div class="relative flex items-center">
                            <span class="absolute left-4 text-amber-500 text-lg">🪙</span>
                            <input type="number" id="b2b-reward" value="5.00" min="3" oninput="window.atualizarPreviewFinanceiro()" 
                                class="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-950 text-amber-400 font-black border-2 border-slate-800 focus:border-amber-500 outline-none transition-all shadow-inner text-lg"
                                style="line-height: 1;">
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Qtd. de Pessoas</label>
                        <input type="number" id="b2b-slots" value="1" min="1" oninput="window.atualizarPreviewFinanceiro()" class="w-full p-3 rounded-xl bg-black text-white font-black border border-white/10 outline-none focus:border-blue-500 transition-all">
                    </div>
                </div>
                <p class="text-[8px] text-gray-500 italic px-2">O sistema reserva o valor total (Qtd × Valor + Taxa).</p>

               <div class="p-5 bg-black/40 rounded-3xl space-y-3 border border-white/5">
                    <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-tight text-gray-500">
                        <span>💰 Valor Líquido</span>
                        <span id="preview-user" class="text-white font-mono">R$ 0,00</span>
                    </div>
                    <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-tight text-gray-500">
                        <span>🛡️ Taxa de Intermediação</span>
                        <span id="preview-tax" class="text-blue-400 font-mono">R$ 0,00</span>
                    </div>
                    <div class="h-[1px] bg-white/10 my-1"></div>
                    <div class="flex justify-between items-center text-xs font-black uppercase tracking-widest text-gray-300">
                        <span>TOTAL A RESERVAR</span>
                        <span id="preview-total" class="text-emerald-500 text-lg font-mono">R$ 10,00</span>
                    </div>
                </div>
            </div>

          <button onclick="window.processarReservaB2B()" id="btn-confirmar-b2b" class="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)] active:scale-95 transition-all">
                Finalizar e Ativar Operação ✅
            </button>
        </div>
    `;

    // 🚀 SINCRONIA IMEDIATA: Dispara o cálculo assim que o Passo 3 abre para evitar valores zerados
    window.atualizarPreviewFinanceiro();
};
// 🤖 CALCULADORA DINÂMICA V2026 (CONECTADA AO BANCO CENTRAL)
window.atualizarPreviewFinanceiro = async () => {
    const val = parseFloat(document.getElementById('b2b-reward').value) || 0;
    const slots = parseInt(document.getElementById('b2b-slots').value) || 1;
    
   // 🏦 SINCRONIA TOTAL: O código não assume valores. Ele lê o que você definiu no Admin.
    const configSnap = await getDoc(doc(db, "settings", "global_economy"));
    // Se o campo não existir, a taxa é 0. O Admin é o único soberano.
    const taxaConfig = (configSnap.exists() && configSnap.data().taxa_lucro_b2b !== undefined) 
        ? Number(configSnap.data().taxa_lucro_b2b) 
        : 0;
    const recompensaTotalUsuarios = val * slots;
    // Gil, agora o cálculo usa os seus 70% (ou o que você definir)
    const taxaTotalAtlivio = recompensaTotalUsuarios * (taxaConfig / 100);
    const totalGeral = recompensaTotalUsuarios + taxaTotalAtlivio;

    document.getElementById('preview-user').innerText = `R$ ${recompensaTotalUsuarios.toFixed(2)}`;
    document.getElementById('preview-tax').innerText = `R$ ${taxaTotalAtlivio.toFixed(2)} (${taxaConfig}%)`;
    document.getElementById('preview-total').innerText = `R$ ${totalGeral.toFixed(2)}`;
    
    window.wizardB2BData.slots_totais = slots;
    window.wizardB2BData.taxa_aplicada = taxaConfig;
    window.wizardB2BData.total_with_fee = totalGeral;
};

// ⚡ MOTOR DE RESERVA V2026: Sincronia Total com Banco Central
window.processarReservaB2B = async () => {
    // 📥 CAPTURA ÚNICA E SEGURA DOS VALORES
    const rewardVal = parseFloat(document.getElementById('b2b-reward')?.value || 0);
    const slotsVal = parseInt(document.getElementById('b2b-slots')?.value || 1);
    const enderecoFormatado = document.getElementById('mis-address-search')?.value || "";

    if(rewardVal < 3) return alert("O valor mínimo de recompensa é R$ 3,00");

    const btn = document.getElementById('btn-confirmar-b2b');
    if(btn) {
        btn.disabled = true;
        btn.innerText = "⏳ RESERVANDO SALDO...";
    }

    // 🛡️ BUSCA DE TAXA SOBERANA (Gaveta Global Economy)
    const configSnap = await getDoc(doc(db, "settings", "global_economy"));
    const taxaOficial = (configSnap.exists() && configSnap.data().taxa_lucro_b2b !== undefined) 
        ? Number(configSnap.data().taxa_lucro_b2b) 
        : 0;

    // 💰 CÁLCULO DINÂMICO DE DÉBITO
    const recompensaTotal = rewardVal * slotsVal;
    const taxaAtlivioReal = recompensaTotal * (taxaOficial / 100); 
    const totalNecessario = recompensaTotal + taxaAtlivioReal;
    const uid = auth.currentUser?.uid;
    if(!uid) return alert("Erro: Usuário não autenticado.");
    const userRef = doc(db, "usuarios", uid);

    // 🧠 CONSULTA DE AUTONOMIA: Verifica se a missão entra direto ou vai para curadoria
    const ecoSnap = await getDoc(doc(db, "settings", "global_economy"));
    const radarAutomatico = ecoSnap.exists() ? (ecoSnap.data().auto_publish_b2b || false) : false;

    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw "Perfil não encontrado.";
            
            const bal = userSnap.data().wallet_balance || 0;
            if (bal < totalNecessario) throw "Saldo insuficiente! Faça uma recarga para continuar.";

            // 1. Debita o valor total (Vagas x [Valor+Taxa]) e move para reserva
            transaction.update(userRef, {
                wallet_balance: increment(-totalNecessario),
                wallet_reserved: increment(totalNecessario),
                updated_at: serverTimestamp()
            });

          // 2. 🛡️ CRIAÇÃO BLINDADA B2B: Sincroniza com os novos nomes de variáveis (rewardVal / slotsVal)
            const unitWithFee = totalNecessario / slotsVal; 
            
            const missionRef = doc(collection(db, "missions"));
            // 🔐 Gravação Soberana: Unifica owner_id e status dinâmico para escala industrial
            transaction.set(missionRef, {
                ...window.wizardB2BData,
                owner_id: auth.currentUser.uid, 
                reward: rewardVal,
                unit_total_with_fee: unitWithFee, 
                total_with_fee: totalNecessario,
                slots_totais: slotsVal,
                slots_disponiveis: slotsVal,
                pessoas_realizando: 0,
               address: enderecoFormatado,
               pay_type: 'atlix', // 🛡️ RIGIDEZ ATLIVIO: Garante liquidação em crédito interno
                // 🚀 STATUS DINÂMICO: Se Radar Auto estiver ON, nasce 'active'. Se não, 'pending_b2b'
                status: radarAutomatico ? 'active' : 'pending_b2b',
                active: radarAutomatico ? true : false,
                published_at: radarAutomatico ? serverTimestamp() : null,
                b2b_name: window.userProfile?.nome_fantasia || window.userProfile?.nome || "Empresa B2B",
                created_at: serverTimestamp()
            });

           // 3. Livro Razão B2B: Sincronizado com slotsVal
            const extratoRef = doc(collection(db, "extrato_financeiro"));
            transaction.set(extratoRef, {
                uid: uid,
                valor: -totalNecessario,
                tipo: "RESERVA_B2B 🔒",
                descricao: `Reserva: ${slotsVal}x ${window.wizardB2BData.title}`,
                moeda: "BRL",
                timestamp: serverTimestamp()
            });
        });

        const msgSucesso = radarAutomatico 
            ? "🚀 OPERAÇÃO ATIVA!\nSua missão já está visível no radar para todos os usuários."
            : "✅ OPERAÇÃO LANÇADA!\nSua missão foi enviada para análise e será publicada no radar em instantes.";
        
        alert(msgSucesso);
        document.getElementById('modal-editor').classList.add('hidden');
        window.carregarOrdensB2B();

    } catch (e) {
        console.error("Erro Reserva B2B:", e);
        
        // 🗣️ TRADUTOR DE ERROS ATLIVIO
        let msgAmigavel = "Não foi possível completar a reserva agora.";
        if (e.toString().includes("insuficiente")) msgAmigavel = "Saldo insuficiente! Recarregue sua carteira para lançar esta missão.";
        else if (e.toString().includes("undefined")) msgAmigavel = "Erro nos valores informados. Por favor, reinicie o assistente de criação.";

        alert(`⚠️ OPS! \n\n${msgAmigavel}`);
        
        btn.disabled = false;
        btn.innerText = "Finalizar e Ativar Operação ✅";
    }
};

// 🔐 SOLDAGEM GLOBAL: Gil, aqui entregamos a chave da Gestão para o app.js
window.initB2B = initB2B;
window.carregarOrdensB2B = carregarOrdensB2B;
window.carregarAuditoriaB2B = carregarAuditoriaB2B;

console.log("💼 [Atlas B2B] Módulo Financeiro e Checkout Soldado!");
