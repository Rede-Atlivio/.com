// 🛡️ TRAVA ANTI-VAZAMENTO: Se não for cliente, o módulo B2B se auto-desliga
if (window.userProfile && window.userProfile.perfil !== 'cliente') {
    console.warn("🚫 [B2B] Acesso negado: Perfil não compatível.");
}
import { db, auth } from '../config.js';
import { collection, getDocs, getDoc, doc, query, where, addDoc, serverTimestamp, orderBy, runTransaction, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🏢 MOTOR DE INTERFACE EXCLUSIVA B2B (V63 - ESCALA INDUSTRIAL)
// Gil, este arquivo cuida apenas de quem CONTRATA inteligência.
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
            const statusColor = m.status === 'active' ? 'text-emerald-500' : 'text-amber-500';
            lista.innerHTML += `
                <div class="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
                    <div class="flex justify-between items-start">
                        <span class="text-[7px] font-black bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase tracking-widest">ID: ${doc.id.slice(0,8)}</span>
                        <span class="text-[8px] font-black uppercase ${statusColor}">${m.status === 'active' ? '● Ativa no Radar' : '⏳ Aguardando...'}</span>
                    </div>
                    <h4 class="text-blue-900 font-black uppercase text-xs">${m.title}</h4>
                    <p class="text-[9px] text-gray-400 leading-tight">${m.description}</p>
                    <div class="flex justify-between items-center pt-2 border-t border-gray-50 gap-2">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-bold text-emerald-600">R$ ${m.reward.toFixed(2)}</span>
                            <span class="text-[7px] font-black text-gray-400 uppercase">${m.pay_type === 'real' ? 'Dinheiro' : 'Atlix'}</span>
                        </div>
                        ${m.status !== 'closed' ? `
                            <button onclick="window.encerrarMissaoB2BComEstorno('${doc.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all border border-red-100">
                                ⛔ Encerrar e Reembolsar
                            </button>
                        ` : '<span class="text-[8px] font-black text-gray-300 uppercase">Encerrada</span>'}
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
        const q = query(
            collection(db, "mission_submissions"),
            where("b2b_owner_uid", "==", auth.currentUser.uid),
            where("status", "==", "pending"),
            orderBy("created_at", "desc")
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = `<p class="text-center py-20 text-gray-500 text-[10px] font-black uppercase tracking-tighter">Nenhuma evidência para auditar.</p>`;
            return;
        }

        container.innerHTML = `<div class="grid gap-4" id="lista-auditoria-cards"></div>`;
        snap.forEach(d => {
            const m = d.data();
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
                // ⏳ MODO MANUAL: B2B deu o OK, mas o Gil precisa dar o "Enter" final
                await updateDoc(doc(db, "mission_submissions", docId), {
                    status: 'approved_by_b2b',
                    status_history: 'Aguardando liberação final do Banco Central',
                    reviewed_at: serverTimestamp()
                });
                alert("⚠️ OK ENVIADO: A aprovação foi registrada. O pagamento será liberado pelo Admin Atlivio.");
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

            // 1. Libera a reserva do B2B (Dá baixa no valor que estava 'preso')
            transaction.update(b2bRef, { 
                wallet_reserved: increment(-data.reward),
                updated_at: serverTimestamp()
            });

            // 2. Se for pagamento em ATLIX (Bônus), credita na hora para o usuário
            if (data.pay_type === 'atlix') {
                transaction.update(userRef, { 
                    wallet_bonus: increment(data.reward),
                    updated_at: serverTimestamp()
                });
                // Marca como pago totalmente
                transaction.update(subRef, { status: 'paid_atlix', paid_at: serverTimestamp() });
            } else {
                // 3. Se for REAL, move para a fila de PIX do Admin
                transaction.update(subRef, { status: 'approved_pending_pix', approved_at: serverTimestamp() });
            }
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
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Valor por Foto</label>
                        <div class="relative">
                            <span class="absolute left-3 top-3.5 text-emerald-500 font-black text-sm">R$</span>
                            <input type="number" id="b2b-reward" value="5.00" min="3" oninput="window.atualizarPreviewFinanceiro()" class="w-full p-3 pl-9 rounded-xl bg-black text-emerald-400 font-black border border-emerald-500/20 outline-none focus:border-emerald-500 transition-all">
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
                        <span>💰 Recompensa (Prestador)</span>
                        <span id="preview-user" class="text-white font-mono">R$ 5,00</span>
                    </div>
                    <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-tight text-gray-500">
                        <span>🛡️ Taxa Administrativa (100%)</span>
                        <span id="preview-tax" class="text-blue-400 font-mono">R$ 5,00</span>
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
};
// 🤖 CALCULADORA DINÂMICA
window.atualizarPreviewFinanceiro = () => {
    const val = parseFloat(document.getElementById('b2b-reward').value) || 0;
    const slots = parseInt(document.getElementById('b2b-slots').value) || 1;
    
    // Regra: (Valor do Usuário + Taxa Atlivio) × Quantidade de Pessoas
    const recompensaTotalUsuarios = val * slots;
    const taxaTotalAtlivio = val * slots; // Mantendo 100% de taxa sobre o valor bruto
    const totalGeral = recompensaTotalUsuarios + taxaTotalAtlivio;

    document.getElementById('preview-user').innerText = `R$ ${recompensaTotalUsuarios.toFixed(2)}`;
    document.getElementById('preview-tax').innerText = `R$ ${taxaTotalAtlivio.toFixed(2)}`;
    document.getElementById('preview-total').innerText = `R$ ${totalGeral.toFixed(2)}`;
    
    // Guarda na memória temporária para o processamento final
    window.wizardB2BData.slots_totais = slots;
    window.wizardB2BData.total_with_fee = totalGeral;
};

// ⚡ MOTOR DE RESERVA (O CORAÇÃO DO B2B)
// ⚡ MOTOR DE RESERVA V2026: Multi-vagas e Auto-Geocodificação
window.processarReservaB2B = async () => {
    const reward = parseFloat(document.getElementById('b2b-reward').value);
    const slots = parseInt(document.getElementById('b2b-slots').value) || 1;
    const enderecoFormatado = document.getElementById('mis-address-search')?.value || "";

    if(reward < 3) return alert("O valor mínimo é R$ 3,00");

    const btn = document.getElementById('btn-confirmar-b2b');
    btn.disabled = true;
    btn.innerText = "⏳ RESERVANDO SALDO...";

    const totalNecessario = window.wizardB2BData.total_with_fee;
    const uid = auth.currentUser.uid;
    const userRef = doc(db, "usuarios", uid);

    // 🧠 CONSULTA DE AUTONOMIA: Verifica se o Gil liberou o Radar Automático
    const ecoSnap = await getDoc(doc(db, "settings", "global_economy"));
    const radarAutomatico = ecoSnap.exists() ? ecoSnap.data().auto_publish_b2b : false;

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

           // 2. 🛡️ CRIAÇÃO BLINDADA B2B: Salva valores unitários para liquidação futura
            const unitWithFee = totalNecessario / slots; // Valor que a empresa paga por CADA foto (Recompensa + Taxa Atlivio)
            
            const missionRef = doc(collection(db, "missions"));
           // 🔐 Gravação Soberana: Garante que o owner_id seja o UID de quem paga a missão
            transaction.set(missionRef, {
                ...window.wizardB2BData,
                owner_id: auth.currentUser.uid, 
                reward: reward,
                unit_total_with_fee: unitWithFee, // 💸 Campo mestre para o estorno e lucro
                total_with_fee: totalNecessario,
                slots_totais: slots,
                slots_disponiveis: slots,
                pessoas_realizando: 0,
                address: enderecoFormatado,
                pay_type: 'real',
                status: 'pending_b2b',
                active: false,
                b2b_name: window.userProfile?.nome_fantasia || window.userProfile?.nome || "Empresa B2B",
                created_at: serverTimestamp()
            });

            // 3. Livro Razão B2B
            const extratoRef = doc(collection(db, "extrato_financeiro"));
            transaction.set(extratoRef, {
                uid: uid,
                valor: -totalNecessario,
                tipo: "RESERVA_B2B 🔒",
                descricao: `Reserva: ${slots}x ${window.wizardB2BData.title}`,
                moeda: "BRL",
                timestamp: serverTimestamp()
            });
        });

        alert("🚀 OPERAÇÃO LANÇADA!\nO endereço e as coordenadas foram configurados. A ATLIVIO publicará no radar após breve revisão.");
        document.getElementById('modal-editor').classList.add('hidden');
        window.carregarOrdensB2B();

    } catch (e) {
        console.error("Erro Reserva B2B:", e);
        alert("❌ FALHA NA RESERVA: " + e);
        btn.disabled = false;
        btn.innerText = "Finalizar e Ativar Operação ✅";
    }
};

// 🔐 SOLDAGEM GLOBAL: Gil, aqui entregamos a chave da Gestão para o app.js
window.initB2B = initB2B;
window.carregarOrdensB2B = carregarOrdensB2B;
window.carregarAuditoriaB2B = carregarAuditoriaB2B;

console.log("💼 [Atlas B2B] Módulo Financeiro e Checkout Soldado!");
