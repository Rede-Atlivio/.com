// 1. AJUSTE NOS IMPORTS (Importe 'app' e 'getAuth')
import { app, auth, db, provider } from './config.js';
import { getAuth, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 3. FUNÇÃO DE AUTOMAÇÃO (V23.2 - LÓGICA DE ADMIN RESPEITADA)
async function concederBonusSeAtivo(userUid) {
    try {
        const userRef = doc(db, "usuarios", userUid);
        const userSnap = await getDoc(userRef);
        
        // Se o usuário já recebeu o bônus alguma vez, para aqui.
        if (userSnap.exists() && userSnap.data().bonus_inicial_ok) return;

        const configSnap = await getDoc(doc(db, "settings", "global"));
        const config = configSnap.data();

        // Só concede se estiver ATIVO no Admin
        if (config?.bonus_boas_vindas_ativo) {
            await updateDoc(userRef, {
                wallet_bonus: parseFloat(config.valor_bonus_promocional) || 20.00,
                bonus_inicial_ok: true
            });
            console.log("🎁 Bônus inicial concedido via Admin.");
        }
    } catch(e) { console.warn("🎁 Bônus: Regra de Admin ignorada ou usuário novo."); }
}
const storage = getStorage();
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";
const TAXA_PLATAFORMA = 0.20; 
const LIMITE_CREDITO_NEGATIVO = -60.00; 

export let userProfile = null; 
window.userProfile = null;

const CATEGORIAS_SERVICOS = [
    "🛠️ Montagem de Móveis", "🛠️ Reparos Elétricos", "🛠️ Instalação de Ventilador", 
    "🛠️ Pintura", "🛠️ Limpeza Residencial", "🛠️ Diarista", "🛠️ Jardinagem", 
    "🛠️ Encanador", "🛠️ Pedreiro", "🛠️ Marido de Aluguel", "🛠️ Conserto de Eletrodoméstico",
    "💻 Design Gráfico", "💻 Edição de Vídeo", "💻 Gestão de Redes Sociais", 
    "💻 Digitação", "💻 Suporte Técnico", "💻 Aulas Particulares", 
    "🚗 Motorista", "🛵 Entregador", "📷 Fotógrafo", "💅 Manicure/Pedicure", "💇 Cabeleireiro(a)", "Outros"
];

// ============================================================================
// 1. LOGIN & RASTREAMENTO (ATUALIZADO)
// ============================================================================

window.loginGoogle = async () => { 
    console.log("🔄 Login Iniciado..."); 
    // Salva a origem no Session Storage para sobreviver ao Redirect
    const origem = localStorage.getItem("traffic_source");
    if(origem) sessionStorage.setItem("pending_ref", origem);
    signInWithRedirect(auth, provider); 
};

window.logout = () => signOut(auth).then(() => location.reload());

// PROCESSAMENTO PÓS-LOGIN (Afiliados + Criação de Conta)
getRedirectResult(auth).then(async (result) => { 
    if (result) {
        console.log("✅ Login Google OK.");
        const user = result.user;
        const userRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(userRef);

        // 🆕 Se for NOVO USUÁRIO, aplica a indicação
        if (!docSnap.exists()) {
            const indicatedBy = sessionStorage.getItem("pending_ref") || localStorage.getItem("traffic_source");
            let dadosIndicacao = {};

            if (indicatedBy && indicatedBy !== user.uid) {
                console.log("🔗 Usuário indicado por:", indicatedBy);
                dadosIndicacao = { invited_by: indicatedBy, traffic_source: 'afiliado' };
                // Notifica o Padrinho
                try {
                    await addDoc(collection(db, "notifications"), {
                        uid: indicatedBy,
                        message: `🎉 Nova indicação! ${user.displayName || 'Alguém'} entrou pelo seu link.`,
                        read: false, type: 'success', created_at: serverTimestamp()
                    });
                } catch(e) {}
            } else {
                dadosIndicacao = { traffic_source: localStorage.getItem("traffic_source") || 'direto' };
            }

            // Cria perfil inicial (o resto vem no onAuthStateChanged)
            await setDoc(userRef, {
                uid: user.uid, email: user.email, created_at: serverTimestamp(), ...dadosIndicacao
            }, { merge: true });
        }
        sessionStorage.removeItem("pending_ref");
    }
}).catch((error) => console.error("❌ Erro Login:", error));

// ============================================================================
// 2. PERFIL & CORE (FUNCIONALIDADES MANTIDAS)
// ============================================================================

window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    try { await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { is_provider: tipo === 'prestador', perfil_completo: true }); location.reload(); } catch(e) { alert("Erro: " + e.message); }
};

window.alternarPerfil = async () => {
    if(!userProfile) return;
    
    // 🔥 ATIVA O OVERLAY DE TRANSIÇÃO IMEDIATAMENTE
    const overlay = document.getElementById('transition-overlay');
    if(overlay) overlay.classList.remove('hidden');

    const btn = document.getElementById('btn-trocar-perfil');
    if(btn) { btn.innerHTML = "🔄 Aguarde..."; btn.disabled = true; }

    try { 
        // 🔒 SET FLAG: Avisa o sistema que é uma troca de perfil, não um logout
        sessionStorage.setItem('is_toggling_profile', 'true');

        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            is_provider: !userProfile.is_provider 
        }); 
        // O reload agora acontece "por trás" da tela azul de transição
        setTimeout(() => location.reload(), 300); 
    } catch (e) { 
        sessionStorage.removeItem('is_toggling_profile'); // Limpa flag se der erro
        if(overlay) overlay.classList.add('hidden');
        alert("Erro: " + e.message); 
    }
};

// --- ENFORCER & MONITOR (VERSÃO FINAL V10) ---
onAuthStateChanged(auth, async (user) => {
    const transitionOverlay = document.getElementById('transition-overlay');
    const isToggling = sessionStorage.getItem('is_toggling_profile'); // 🆕 LÊ A FLAG

    if (user) {
        // 1. Limpeza Visual Imediata (Esconde Login)
        document.getElementById('auth-container')?.classList.add('hidden');
        if (transitionOverlay) transitionOverlay.classList.remove('hidden');

        // 🆕 SE LOGOU COM SUCESSO, REMOVE A FLAG (Ciclo completo)
        if (isToggling) sessionStorage.removeItem('is_toggling_profile');

        const userRef = doc(db, "usuarios", user.uid);
        
        // 2. Monitoramento Real-time do Perfil
        onSnapshot(userRef, async (docSnap) => {
            try {
                if (!docSnap.exists()) {
                    // CRIAÇÃO DE NOVO PERFIL V12 (BLINDADO)
                    const trafficSource = localStorage.getItem("traffic_source") || "direct";
                    const novoPerfil = { 
                        email: user.email, 
                        phone: user.phoneNumber, 
                        displayName: user.displayName || "Usuário", 
                        photoURL: user.photoURL, 
                        tenant_id: DEFAULT_TENANT, 
                        perfil_completo: false, 
                        role: (user.email && ADMIN_EMAILS.includes(user.email)) ? 'admin' : 'user', 
                        wallet_balance: 0.00, 
                        // Campo saldo removido globalmente da criação de conta - PONTO CRÍTICO SOLUÇÃO BÔNUS
                        is_provider: false, 
                        created_at: serverTimestamp(), 
                        status: 'ativo',
                        traffic_source: trafficSource,
                        termo_aceito_versao: "05-02-2026" // ✅ Blindagem Jurídica Automática
                    };
                    userProfile = novoPerfil; 
                    window.userProfile = novoPerfil;
                    await setDoc(userRef, novoPerfil);
                    await concederBonusSeAtivo(user.uid);
                } else {
                    // CARREGAMENTO DE PERFIL EXISTENTE
                    const data = docSnap.data();
                    
                    if (data.status === 'banido') console.warn("🚫 Usuário Banido.");
                    if (data.status === 'suspenso' && data.is_online) {
                        setDoc(doc(db, "active_providers", user.uid), { is_online: false }, { merge: true });
                    }
                    
                    // 💰 BLINDAGEM DE SALDO V13: Leitura exclusiva do campo oficial - PONTO CRÍTICO SOLUÇÃO BÔNUS
                    data.wallet_balance = parseFloat(data.wallet_balance || 0);
                    if (isNaN(data.wallet_balance)) data.wallet_balance = 0;

                    // 🛰️ RASTREADOR DE PRESENÇA: Atualiza o banco sem dar reload na interface
                    if (!window.presencaRegistrada) {
                        updateDoc(userRef, { last_active: serverTimestamp() });
                        window.presencaRegistrada = true;
                    }

                    userProfile = data; 
                    window.userProfile = data;
                    
                    aplicarRestricoesDeStatus(data.status);
                    renderizarBotaoSuporte(); 

                    if (data.status !== 'banido') {
                        atualizarInterfaceUsuario(userProfile);
                        iniciarAppLogado(user); 
                        
                        if (userProfile.is_provider) {
                            
                        if (userProfile.is_provider) {
                            verificarStatusERadar(user.uid);
                        }
                    }
                }
            } catch (err) { 
                console.error("Erro perfil:", err); 
                iniciarAppLogado(user); 
            }
        });
    } else {
        // 🆕 SE ESTIVER NA TROCA DE PERFIL, NÃO MOSTRA TELA DE LOGIN!
        if (isToggling) {
            document.getElementById('auth-container')?.classList.add('hidden');
            if (transitionOverlay) transitionOverlay.classList.remove('hidden');
            return; // 🛑 PARA AQUI E NÃO RODA O CÓDIGO DE LOGOUT
        }

        // 3. Lógica de Logout / Usuário Deslogado (Só roda se NÃO for troca de perfil)
        document.getElementById('auth-container')?.classList.remove('hidden');
        document.getElementById('role-selection')?.classList.add('hidden');
        document.getElementById('app-container')?.classList.add('hidden');
        
        // Garante que o overlay suma no login
        if (transitionOverlay) transitionOverlay.classList.add('hidden');
        removerBloqueiosVisuais();
    }
});

// ============================================================================
// 3. SISTEMA DE SUPORTE
// ============================================================================
function renderizarBotaoSuporte() {
    if(document.getElementById('btn-floating-support')) return;
    const btn = document.createElement('div');
    btn.id = 'btn-floating-support';
    btn.className = 'fixed bottom-4 right-4 z-[200] animate-bounce-slow';
    btn.innerHTML = `<button onclick="window.abrirChatSuporte()" class="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl border-2 border-white transition transform hover:scale-110">💬</button>`;
    document.body.appendChild(btn);
}

window.abrirChatSuporte = async () => {
    let modal = document.getElementById('modal-support-chat');
    if(!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="modal-support-chat" class="fixed inset-0 z-[210] bg-black/50 hidden flex items-end sm:items-center justify-center">
                <div class="bg-white w-full sm:w-96 h-[80vh] sm:h-[600px] sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-slideUp">
                    <div class="bg-blue-900 p-4 text-white flex justify-between items-center">
                        <div><h3 class="font-bold">Suporte Atlivio</h3><p class="text-[10px] opacity-75">Fale com nossa equipe</p></div>
                        <button onclick="document.getElementById('modal-support-chat').classList.add('hidden')" class="text-white font-bold text-xl">&times;</button>
                    </div>
                    <div id="support-messages" class="flex-1 p-4 overflow-y-auto bg-gray-100 space-y-3">
                        <p class="text-center text-gray-400 text-xs mt-4">Carregando histórico...</p>
                    </div>
                    <div class="p-3 bg-white border-t flex gap-2">
                        <input type="text" id="support-input" class="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Digite sua mensagem...">
                        <button onclick="window.enviarMensagemSuporte()" class="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow">➤</button>
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('modal-support-chat');
    }
    modal.classList.remove('hidden');
    carregarMensagensSuporte();
};

let unsubscribeSuporte = null;
function carregarMensagensSuporte() {
    const container = document.getElementById('support-messages');
    const uid = auth.currentUser.uid;
    if(unsubscribeSuporte) unsubscribeSuporte(); 
    const q = query(collection(db, "support_tickets"), where("uid", "==", uid), orderBy("created_at", "asc"));
    unsubscribeSuporte = onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if(snap.empty) {
            container.innerHTML = `<div class="text-center py-10"><p class="text-4xl mb-2">👋</p><p class="text-gray-500 text-xs">Olá! Como podemos ajudar?</p></div>`;
        }
        snap.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.sender === 'user';
            container.innerHTML += `
                <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                    <div class="${isMe ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border'} max-w-[80%] rounded-xl px-4 py-2 text-xs shadow-sm">
                        <p>${msg.message}</p>
                        <p class="text-[9px] ${isMe ? 'text-blue-200' : 'text-gray-400'} text-right mt-1">${msg.created_at?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || '...'}</p>
                    </div>
                </div>
            `;
        });
        container.scrollTop = container.scrollHeight;
    });
}

window.enviarMensagemSuporte = async () => {
    const input = document.getElementById('support-input');
    const txt = input.value.trim();
    if(!txt) return;
    input.value = ""; 
    try {
        await addDoc(collection(db, "support_tickets"), {
            uid: auth.currentUser.uid,
            sender: 'user', 
            message: txt,
            created_at: serverTimestamp(),
            user_email: userProfile.email || "Sem Email",
            user_name: userProfile.displayName || "Usuário",
            read: false
        });
    } catch(e) {
        alert("Erro ao enviar: " + e.message);
    }
};

// ============================================================================
// 4. HELPERS DE INTERFACE & STATUS
// ============================================================================

function aplicarRestricoesDeStatus(status) {
    const body = document.body;
    const bloqueioID = "bloqueio-total-overlay"; const avisoID = "aviso-suspenso-bar";
    const oldBlock = document.getElementById(bloqueioID); const oldBar = document.getElementById(avisoID);
    if(oldBlock) oldBlock.remove(); if(oldBar) oldBar.remove();

    if (status === 'banido') {
        const jailHtml = `
            <div id="${bloqueioID}" class="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade">
                <div class="bg-red-500/10 p-6 rounded-full mb-6 border-4 border-red-500 animate-pulse"><span class="text-6xl">🚫</span></div>
                <h1 class="text-3xl font-black text-white mb-2">CONTA BLOQUEADA</h1>
                <p class="text-gray-400 mb-8 max-w-md">Violação dos termos de uso.</p>
                <button onclick="window.abrirChatSuporte()" class="bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-lg animate-bounce">Falar com Suporte</button>
                <button onclick="window.logout()" class="text-gray-500 text-xs mt-4 underline">Sair</button>
            </div>
        `;
        body.insertAdjacentHTML('beforeend', jailHtml);
    } 
    else if (status === 'suspenso') {
        const warningHtml = `<div id="${avisoID}" class="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white text-xs font-bold px-4 py-2 text-center shadow-xl flex justify-between items-center"><span class="flex items-center gap-2"><i class="animate-pulse">⚠️</i> SUSPENSO</span><button onclick="window.abrirChatSuporte()" class="bg-white/20 px-2 py-1 rounded text-[10px]">Suporte</button></div>`;
        body.insertAdjacentHTML('beforeend', warningHtml);
        document.getElementById('header-main')?.classList.add('mt-8');
    } else { document.getElementById('header-main')?.classList.remove('mt-8'); }
}

function removerBloqueiosVisuais() { document.getElementById("bloqueio-total-overlay")?.remove(); document.getElementById("aviso-suspenso-bar")?.remove(); }

function atualizarInterfaceUsuario(dados) {
    // 1. Atualiza Fotos de Perfil
    document.querySelectorAll('img[id$="-pic"], #header-user-pic, #provider-header-pic').forEach(img => { if(dados.photoURL) img.src = dados.photoURL; });
    
    // 2. Define o Nome Correto (Prioridade: Engrenagem > Profissional > Google)
    const nomeFinal = dados.nome || dados.nome_profissional || dados.displayName || "Usuário";

    // 3. Atualiza Header do Cliente (Se existir)
    const nameEl = document.getElementById('header-user-name'); 
    if(nameEl) nameEl.innerText = nomeFinal;

    // 4. Atualiza Painel Dashboard (Elemento sem ID - Busca por classe para garantir)
    const dashEl = document.querySelectorAll('h3.text-gray-800.font-bold.text-xs.truncate');
    dashEl.forEach(el => {
        // 🔒 TRAVA DE SEGURANÇA: Só altera se NÃO tiver saldo dentro (previne apagar R$)
        if(el && !el.innerText.includes('R$')) {
            el.innerText = nomeFinal;
        }
    });

    // 5. Atualiza Header do Prestador (BLINDAGEM DE SALDO DO ID provider-header-name)
    const provNameEl = document.getElementById('provider-header-name');
    if(provNameEl) {
        const saldo = parseFloat(dados.wallet_balance || 0); 
        // ⚠️ AQUI ESTÁ O SEGREDO: Recria o nome E o saldo juntos para não perder o dinheiro da tela
        provNameEl.innerHTML = `${nomeFinal}<span id="header-balance-badge" class="ml-2 text-[10px] px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-600 font-bold"> R$ ${saldo.toFixed(2)}</span>`;
    }
}

function iniciarAppLogado(user) {
    // 1. Verificação de Perfil Completo
    if (!userProfile || !userProfile.perfil_completo) { 
        document.getElementById('app-container')?.classList.add('hidden'); 
        document.getElementById('role-selection')?.classList.remove('hidden'); 
        // 🔥 Garante que o overlay suma se for para a seleção de perfil
        document.getElementById('transition-overlay')?.classList.add('hidden');
        return; 
    }

    // 2. Revela o App e limpa o Overlay de Transição
    document.getElementById('role-selection')?.classList.add('hidden'); 
    document.getElementById('app-container')?.classList.remove('hidden');

    // Remove a tela azul após um pequeno delay para suavizar a entrada
    setTimeout(() => {
        const overlay = document.getElementById('transition-overlay');
        if (overlay) overlay.classList.add('hidden');
    }, 600);

    // 3. Lógica de Admin e Interface
    const btnPerfil = document.getElementById('btn-trocar-perfil');
    const userEmail = user.email ? user.email.toLowerCase().trim() : "";
    const isAdmin = userEmail && ADMIN_EMAILS.some(adm => adm.toLowerCase() === userEmail);
    if (isAdmin) document.getElementById('tab-admin')?.classList.remove('hidden');

    if (userProfile.is_provider) {
        if (btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN` : `Sou: <span class="perfil-prestador-tag">PRESTADOR</span> 🔄`;
        const tabServ = document.getElementById('tab-servicos');
        if (tabServ) tabServ.innerText = "Serviços 🛠️";
        
        ['tab-servicos', 'tab-missoes', 'tab-oportunidades', 'tab-ganhar', 'status-toggle-container', 'servicos-prestador'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('hidden');
        });
        document.getElementById('servicos-cliente')?.classList.add('hidden');
        
        // 🛡️ Sincronização Maestro: A aba será aberta pelo app.js uma única vez.
    } else {
        if (btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN` : `Sou: <span class="perfil-cliente-tag">CLIENTE</span> 🔄`;
        const tabServ = document.getElementById('tab-servicos');
        if (tabServ) tabServ.innerText = "Contratar 🛠️";
        
        ['tab-servicos', 'tab-oportunidades', 'tab-loja', 'tab-ganhar', 'servicos-cliente'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('hidden');
        });
        ['tab-missoes', 'status-toggle-container', 'servicos-prestador'].forEach(id => {
            document.getElementById(id)?.classList.add('hidden');
        });
        
       setTimeout(() => { 
            const tab = document.getElementById('tab-servicos'); 
            if (window.switchTab) window.switchTab('servicos');
            else if (tab) tab.click();
            
            if (window.carregarServicos) window.carregarServicos();
            if (window.carregarVagas) window.carregarVagas(); 
            if (window.carregarOportunidades) window.carregarOportunidades();
        }, 1500);
    }
}

async function verificarStatusERadar(uid) {
    const toggle = document.getElementById('online-toggle');
    try {
        const snap = await getDoc(doc(db, "active_providers", uid));
        if(snap.exists()) {
            const data = snap.data();
            const isOnline = data.is_online && data.status === 'aprovado';
            if(toggle) {
                toggle.checked = isOnline;
                if(data.status === 'em_analise') { toggle.disabled = true; document.getElementById('status-label').innerText = "🟡 EM ANÁLISE"; }
                else if(data.status === 'banido') { toggle.disabled = true; toggle.checked = false; document.getElementById('status-label').innerText = "🔴 BANIDO"; }
                else if(data.status === 'suspenso') { toggle.disabled = true; toggle.checked = false; document.getElementById('status-label').innerText = "⚠️ SUSPENSO"; }
                else { toggle.disabled = false; document.getElementById('status-label').innerText = isOnline ? "ONLINE" : "OFFLINE"; }
            }
            if(isOnline) iniciarRadarPrestador(uid); else renderizarRadarOffline();
        }
    } catch(e) {}
}

function renderizarRadarOffline() {
    // 🛡️ DESACOPLAMENTO V23: Apenas sinaliza o desligamento do Radar
    // Sem interferir na visibilidade das outras abas (Andamento/Histórico)
    if (window.garantirContainerRadar) window.garantirContainerRadar();
    console.log("📡 [SISTEMA] Radar em modo espera (Offline).");
}
document.addEventListener('change', async (e) => {
    if (e.target && e.target.id === 'online-toggle') {
        const novoStatus = e.target.checked;
        const uid = auth.currentUser?.uid;
        if(!uid) return;
        const snap = await getDoc(doc(db, "active_providers", uid));
        if(snap.exists()) {
            const st = snap.data().status;
            if(st === 'em_analise') { e.target.checked = false; return alert("⏳ Seu perfil está em análise."); }
            if(st === 'banido') { e.target.checked = false; return alert("⛔ Você foi banido."); }
            if(st === 'suspenso') { e.target.checked = false; return alert("⚠️ CONTA SUSPENSA."); }
        }
        if (novoStatus) { 
            iniciarRadarPrestador(uid); 
            document.getElementById('online-sound')?.play().catch(()=>{}); 
        } else { 
            // 🛰️ Deixa o request_v2.js decidir se precisa de reload ou não
            if (window.pararRadarFisico) window.pararRadarFisico();
            renderizarRadarOffline(); 
        }
        await setDoc(doc(db, "active_providers", uid), { 
    is_online: novoStatus,
    last_update: serverTimestamp() 
}, { merge: true });
    }
});

window.responderPedido = async (orderId, aceitar, valorServico = 0) => {
    if(!aceitar) { await updateDoc(doc(db, "orders", orderId), { status: 'rejected' }); } 
    else {
        if(userProfile?.status === 'suspenso') return alert("⚠️ CONTA SUSPENSA. Você não pode aceitar pedidos.");
        const uid = auth.currentUser.uid; const userRef = doc(db, "usuarios", uid); const snap = await getDoc(userRef);
        const saldoAtual = parseFloat(snap.data().wallet_balance || 0); //  - PONTO CRÍTICO SOLUÇÃO BÔNUS
        if (saldoAtual <= LIMITE_CREDITO_NEGATIVO) return alert(`⛔ LIMITE EXCEDIDO (R$ ${LIMITE_CREDITO_NEGATIVO}).\nSaldo atual: R$ ${saldoAtual.toFixed(2)}.\nRecarregue para continuar.`);
        try { await updateDoc(doc(db, "orders", orderId), { status: 'accepted' }); getDoc(doc(db, "chats", orderId)).then(async (snapChat) => { if(snapChat.exists()) await updateDoc(snapChat.ref, { status: "active" }); }).catch(async () => { await updateDoc(doc(db, "chats", orderId), { status: "active" }); }); alert(`✅ Pedido Aceito!`); if (window.irParaChat) window.irParaChat(); else { document.getElementById('tab-chat').click(); setTimeout(() => { if(window.carregarChat) window.carregarChat(); }, 500); } } catch (e) { alert("Erro: " + e.message); }
    }
};

window.uploadBanner = async (input) => {
    if (!input.files || input.files.length === 0) return; const file = input.files[0]; const user = auth.currentUser; if(file.size > 500000) alert("⚠️ Imagem grande!"); const btn = document.getElementById('btn-upload-banner'); const t = btn.innerText; btn.innerText = "Enviando..."; btn.disabled = true;
    try { const storageRef = ref(storage, `banners/${user.uid}/capa_vitrine.jpg`); await uploadBytes(storageRef, file); const dURL = await getDownloadURL(storageRef); document.getElementById('hidden-banner-url').value = dURL; document.getElementById('preview-banner').src = dURL; document.getElementById('preview-banner').classList.remove('hidden'); document.getElementById('banner-placeholder').classList.add('hidden'); } catch (e) { alert("Erro upload."); } finally { btn.innerText = t; btn.disabled = false; }
};

// ============================================================================
// 👁️ LIVE TRACKING (MONITOR DE CLIQUES)
// ============================================================================
async function logSystemEvent(action, details) {
    try {
        const uid = auth.currentUser ? auth.currentUser.uid : "visitante";
        const email = userProfile ? (userProfile.email || userProfile.displayName || "Sem Nome") : "Visitante";
        
        await addDoc(collection(db, "system_events"), {
            action: action,
            details: details,
            user: email,
            uid: uid,
            timestamp: serverTimestamp(),
            type: 'click'
        });
    } catch(e) {
        console.warn("Log failed:", e);
    }
}

window.addEventListener('click', (e) => {
    const el = e.target.closest('button') || e.target.closest('a') || e.target.closest('.subtab-btn');
    if (el) {
        let identificador = el.id || el.innerText || el.className;
        if(identificador.length > 30) identificador = identificador.substring(0, 30) + "..."; 
        if(!identificador || identificador.includes("container") || identificador.includes("wrapper")) return;
        logSystemEvent("Clique", `Botão: ${identificador}`);
    }
});
// EXPOSIÇÃO GLOBAL PARA O APP.JS
window.verificarSentenca = verificarSentenca;
async function verificarSentenca(uid) {
    const userDoc = await getDoc(doc(db, "usuarios", uid));
    if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.account_status === 'banned' || (data.risk_score || 0) >= 100) {
            alert("🚫 CONTA SUSPENSA: Detectamos atividades irregulares.");
            await auth.signOut();
            window.location.reload();
            return true; 
        }
    }
    return false;
}
// ============================================================================
// 📢 SISTEMA DE AVISO GLOBAL (CLIENTE - ESCUTA EM TEMPO REAL)
// ============================================================================
(function IniciarAvisoGlobal() {
    // Garante que o DB está carregado antes de tentar ouvir
    if (typeof db === 'undefined') return console.warn("Aviso Global: DB não pronto.");

    const ref = doc(db, "configuracoes", "global");
    
    // Ouve alterações no documento 'configuracoes/global'
    onSnapshot(ref, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            const msg = data.top_message || "";
            const ativo = data.show_msg === true; // Garante que é booleano

            let banner = document.getElementById('global-warning-banner');

            // SE TIVER AVISO ATIVO E MENSAGEM:
            if (ativo && msg.length > 0) {
                // Cria o banner se ele não existir
                if (!banner) {
                    banner = document.createElement('div');
                    banner.id = 'global-warning-banner';
                    // Estilo: Amarelo chamativo, fixo no topo, acima de tudo (z-index alto)
                    banner.className = "fixed top-0 left-0 w-full bg-amber-400 text-black font-black text-center text-[10px] uppercase tracking-widest py-2 px-4 z-[99999] shadow-lg animate-slideDown border-b-2 border-amber-600";
                    document.body.prepend(banner);
                    
                    // Empurra o conteúdo do site para baixo para não esconder o header
                    document.body.style.marginTop = "32px"; 
                }
                // Atualiza o texto (caso você mude no Admin sem recarregar)
                banner.innerHTML = `⚠️ ${msg}`;
            
            // SE O AVISO FOR DESATIVADO:
            } else {
                if (banner) {
                    banner.remove();
                    document.body.style.marginTop = "0px"; // Volta o site pro lugar
                }
            }
        }
    }, (error) => {
        console.warn("Silenciando aviso global (sem permissão ou erro de rede).");
    });
})();
// 🌍 EXPOSIÇÃO GLOBAL V23 (PARA O CONSOLE E APP.JS VEREM AS FUNÇÕES)
window.renderizarRadarOffline = renderizarRadarOffline;
window.concederBonusSeAtivo = concederBonusSeAtivo;
console.log("%c✅ AUTH.JS: Funções expostas com sucesso!", "color: #10b981; font-weight: bold;");
