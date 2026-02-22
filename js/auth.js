        
        if (novoStatus) { iniciarRadarPrestador(uid); document.getElementById('online-sound')?.play().catch(()=>{}); } 
        else { renderizarRadarOffline(); }
        await updateDoc(doc(db, "active_providers", uid), { is_online: novoStatus   TA AQUI NESSE BLOCO? : // 1. AJUSTE NOS IMPORTS (Importe 'app' e 'getAuth')
import { app, auth, db, provider } from './config.js';
import { getAuth, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 3. FUNÇÃO DE AUTOMAÇÃO
async function concederBonusSeAtivo(userUid) {
    try {
        const configSnap = await getDoc(doc(db, "settings", "global"));
        const config = configSnap.data();

        if (config?.bonus_boas_vindas_ativo) {
            // Usa updateDoc, mas se falhar (doc não existe), usa setDoc
            //SOLUÇÃO BONUS NA RAIZ - Correção de Referência
            const userRef = doc(db, "usuarios", userUid);
            await setDoc(userRef, {
                wallet_bonus: parseFloat(config.valor_bonus_promocional) || 20.00,
                // Campo 'saldo' removido para evitar duplicidade fantasma
                bonus_inicial_ok: true
            }, { merge: true });
            
            console.log("🎁 Bônus de R$ 20 concedido automaticamente!");
        }
    } catch(e) { console.error("Erro ao dar bônus:", e); }
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
    if(btn) { btn.innerText = "🔄 ..."; btn.disabled = true; }

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
                        updateDoc(doc(db, "active_providers", user.uid), { is_online: false });
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
    verificarStatusERadar(user.uid);
    // Auto-disparo desativado para não irritar o usuário. 
    // Ele só abre se clicar no botão "MEUS SERVIÇOS".
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
        if (btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN` : `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        const tabServ = document.getElementById('tab-servicos');
        if (tabServ) tabServ.innerText = "Serviços 🛠️";
        
        ['tab-servicos', 'tab-missoes', 'tab-oportunidades', 'tab-ganhar', 'status-toggle-container', 'servicos-prestador'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('hidden');
        });
        document.getElementById('servicos-cliente')?.classList.add('hidden');
        
        setTimeout(() => { document.getElementById('tab-servicos')?.click(); }, 1000);
    } else {
        if (btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN` : `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;
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
            if (tab) tab.click(); else if (window.carregarServicos) window.carregarServicos();
            if (window.carregarVagas) window.carregarVagas(); 
            if (window.carregarOportunidades) window.carregarOportunidades();
        }, 1000); 
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
 // 🔐 SEGURANÇA DE STATUS: O Auth apenas valida permissões no banco. PONTO CRÍTICO - TENTATIVA DE SOLUÇÃO DO BUG NO RADAR
document.addEventListener('change', async (e) => {
    if (e.target && e.target.id === 'online-toggle') {
        const uid = auth.currentUser?.uid;
        if(!uid) return;
        const snap = await getDoc(doc(db, "active_providers", uid));
        if(snap.exists()) {
            const st = snap.data().status;
            if(['em_analise', 'banido', 'suspenso'].includes(st)) {
                e.target.checked = false;
                return alert("⚠️ Acesso negado: Perfil " + st.replace('_', ' '));
            }
        }
        await updateDoc(doc(db, "active_providers", uid), { is_online: e.target.checked });
    }
});

window.responderPedido = async (orderId, aceitar, valorServico = 0) => {
    if(!aceitar) { await updateDoc(doc(db, "orders", orderId), { status: 'rejected' }); } 
    else {
        if(userProfile?.status === 'suspenso') return alert("⚠️ CONTA SUSPENSA. Você não pode aceitar pedidos.");
        const uid = auth.currentUser.uid; const userRef = doc(db, "usuarios", uid); const snap = await getDoc(userRef);
        const saldoAtual = parseFloat(snap.data().wallet_balance || 0); //  - PONTO CRÍTICO SOLUÇÃO BÔNUS
        if (saldoAtual <= LIMITE_CREDITO_NEGATIVO) return alert(`⛔ LIMITE EXCEDIDO (R$ ${LIMITE_CREDITO_NEGATIVO}).\nSaldo atual: R$ ${saldoAtual.toFixed(2)}.\nRecarregue para continuar.`);
        try { await updateDoc(doc(db, "orders", orderId), { status: 'accepted' }); getDoc(doc(db, "chats", orderId)).then(async (snapChat) => { if(snapChat.exists()) await updateDoc(snapChat.ref, { status: "active" }); }).catch(async () => { await updateDoc(doc(db, "chats", orderId), { status: "active" }); }); alert(`✅ Pedido Aceito!`); if (window.irParaChat) window.irParaChat(); else { document.getElementById('tab-chat').click(); setTimeout(() => { if(window.carregarChat) window.carregarChat(); }, 500); } } catch (e) { alert("Erro: " + e.message); }
    }
};

window.uploadBanner = async (input) => {
    if (!input.files || input.files.length === 0) return; const file = input.files[0]; const user = auth.currentUser; if(file.size > 500000) alert("⚠️ Imagem grande!"); const btn = document.getElementById('btn-upload-banner'); const t = btn.innerText; btn.innerText = "Enviando..."; btn.disabled = true;
    try { const storageRef = ref(storage, `banners/${user.uid}/capa_vitrine.jpg`); await uploadBytes(storageRef, file); const dURL = await getDownloadURL(storageRef); document.getElementById('hidden-banner-url').value = dURL; document.getElementById('preview-banner').src = dURL; document.getElementById('preview-banner').classList.remove('hidden'); document.getElementById('banner-placeholder').classList.add('hidden'); } catch (e) { alert("Erro upload."); } finally { btn.innerText = t; btn.disabled = false; }
};

window.abrirConfiguracaoServicos = async () => {
    const modal = document.getElementById('provider-setup-modal'); modal.classList.remove('hidden'); const content = document.getElementById('provider-setup-content'); const form = modal.querySelector('div.bg-white') || modal.firstElementChild;
    let d = {}; try { const snap = await getDoc(doc(db, "active_providers", auth.currentUser.uid)); if(snap.exists()) d = snap.data(); } catch(e){}
    const b = d.banner_url||"", bi = d.bio||"", s = d.services||[];
    const inputStyle = "w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none";
    
    // --- LÓGICA DA TARJA ---
    const statusConta = d.status || 'em_analise';
    let badgeHtml = "";
    if(statusConta === 'aprovado') badgeHtml = `<span class="bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ml-2 tracking-wide">✅ APROVADO</span>`;
    else if(statusConta === 'suspenso') badgeHtml = `<span class="bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ml-2 tracking-wide">🔴 SUSPENSO</span>`;
    else badgeHtml = `<span class="bg-yellow-100 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ml-2 tracking-wide">⏳ EM ANÁLISE</span>`;
    // -----------------------

    const servicesHtml = s.length > 0 ? s.map((sv,i)=>`
        <div class="bg-blue-50 p-3 rounded-lg border border-blue-100 flex justify-between items-center mb-2">
            <div>
                <div class="flex items-center">
                    <p class="font-bold text-xs text-blue-900 flex items-center gap-1">🛠️ ${sv.category}</p>
                    ${badgeHtml}
                </div>
                <p class="text-[10px] text-gray-600">R$ ${sv.price}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="window.editarServico(${i})" class="text-blue-500 hover:text-blue-700 p-1 rounded bg-white border border-blue-200" title="Editar">✏️</button>
                <button onclick="window.removerServico(${i})" class="text-red-500 hover:text-red-700 p-1 rounded bg-white border border-red-200" title="Excluir">❌</button>
            </div>
        </div>`).join('') : '<p class="text-xs text-gray-400 italic text-center py-4 border border-dashed border-gray-300 rounded">Nenhum serviço adicionado.</p>';

    form.innerHTML = `
        <div class="p-6 h-[80vh] overflow-y-auto">
            <div class="flex justify-between mb-2">
                <div><h2 class="text-xl font-black text-blue-900">🚀 Perfil Profissional</h2></div>
                <button onclick="document.getElementById('provider-setup-modal').classList.add('hidden')" class="text-gray-400 font-bold text-xl px-2">&times;</button>
            </div>
            <div class="mb-6">
                <label class="text-xs font-bold text-gray-700 uppercase">📸 Capa da Vitrine</label>
                <div class="relative w-full h-32 bg-gray-100 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer" onclick="document.getElementById('banner-input').click()">
                    <img id="preview-banner" src="${b}" class="${b?'':'hidden'} w-full h-full object-cover">
                    <div id="banner-placeholder" class="${b?'hidden':'flex'} flex-col items-center">
                        <span class="text-2xl">🖼️</span>
                    </div>
                </div>
                <input type="file" id="banner-input" class="hidden" onchange="window.uploadBanner(this)">
                <input type="hidden" id="hidden-banner-url" value="${b}">
            </div>
            <div class="mb-6 space-y-3">
                <div><label class="text-xs font-bold text-gray-500 uppercase">Nome Comercial</label><input type="text" id="setup-name" value="${d.nome_profissional||auth.currentUser.displayName||''}" class="${inputStyle}"></div>
                <div><label class="text-xs font-bold text-gray-500 uppercase">Sua Bio (O que você faz de melhor?)</label><textarea id="setup-bio" rows="3" class="${inputStyle}">${bi}</textarea></div>
            </div>
            <div class="mb-6">
                <label class="text-xs font-bold text-gray-700 uppercase block mb-2">🛠️ Seus Serviços Ativos</label>
                <div id="my-services-list" class="mb-4">${servicesHtml}</div>
                <div class="bg-gray-100 p-4 rounded-xl border border-gray-200">
                    <p class="text-[10px] font-bold text-gray-500 uppercase mb-2">Adicionar Novo Serviço</p>
                    <div class="grid grid-cols-1 gap-2 mb-2">
                        <select id="new-service-category" class="${inputStyle}">
                            <option value="" disabled selected>Escolha o Serviço...</option>
                            ${window.SERVICOS_PADRAO.map(s => `
                                <option value="${s.category}" data-price="${s.price}">
                                    ${s.title} (R$ ${s.price}) ${s.level === 'premium' ? '⭐' : ''}
                                </option>
                            `).join('')}
                        </select>
                        <input type="number" id="new-service-price" placeholder="Preço Sugerido R$" class="${inputStyle}">
                    </div>
                    <textarea id="new-service-desc" placeholder="Detalhes específicos deste serviço" class="${inputStyle}" rows="1"></textarea>
                    <button onclick="window.addServiceLocal()" class="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded text-xs font-bold uppercase mt-3 transition shadow">⬇️ ADICIONAR À LISTA</button>
                </div>
            </div>
            <div class="pt-4 border-t flex gap-2">
                <button onclick="document.getElementById('provider-setup-modal').classList.add('hidden')" class="flex-1 bg-gray-200 py-4 rounded-xl font-bold text-xs uppercase text-gray-700">Cancelar</button>
                <button onclick="window.saveServicesAndGoOnline()" class="flex-2 w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black text-sm uppercase shadow-lg transform active:scale-95 transition">💾 SALVAR TUDO</button>
            </div>
        </div>`;
};

window.editarServico = async (i) => {
    const ref = doc(db, "active_providers", auth.currentUser.uid); const snap = await getDoc(ref); let s = snap.data().services; const item = s[i];
    s.splice(i, 1); await updateDoc(ref, { services: s }); await window.abrirConfiguracaoServicos();
    setTimeout(() => {
        document.getElementById('new-service-category').value = item.category;
        document.getElementById('new-service-price').value = item.price;
        document.getElementById('new-service-desc').value = item.description || "";
        document.getElementById('new-service-price').focus();
        alert("✏️ Modo de Edição Ativo.");
    }, 200);
};

window.addServiceLocal = async () => {
    const c = document.getElementById('new-service-category').value; const p = document.getElementById('new-service-price').value; const d = document.getElementById('new-service-desc').value;
    if (!c || !p) return alert("Preencha categoria e preço.");
    const ref = doc(db, "active_providers", auth.currentUser.uid); const snap = await getDoc(ref);
    let s = snap.exists() ? snap.data().services||[] : []; s.push({category:c, price:parseFloat(p), description:d});
    const base = snap.exists() ? {} : {uid:auth.currentUser.uid, created_at:serverTimestamp(), is_online:false, status:'em_analise', visibility_score:100};
    await setDoc(ref, {...base, services:s}, {merge:true}); window.abrirConfiguracaoServicos(); 
};

window.saveServicesAndGoOnline = async () => {
    const n = document.getElementById('setup-name').value; const b = document.getElementById('setup-bio').value; const bn = document.getElementById('hidden-banner-url').value;
    if(!n || !b) return alert("Nome e Bio obrigatórios.");
    const btn = document.querySelector('button[onclick="window.saveServicesAndGoOnline()"]'); if(btn) { btn.innerText="ENVIANDO..."; btn.disabled=true; }
    try {
        await updateDoc(doc(db,"usuarios",auth.currentUser.uid),{nome_profissional:n, setup_profissional_ok:true});
        const ref = doc(db, "active_providers", auth.currentUser.uid);
        const snap = await getDoc(ref);
        const realStatus = snap.exists() ? snap.data().status : 'em_analise';
        const newSt = (realStatus === 'aprovado') ? 'aprovado' : 'em_analise';
        await setDoc(ref,{uid:auth.currentUser.uid, nome_profissional:n, foto_perfil:userProfile.photoURL, bio:b, banner_url:bn, status:newSt, updated_at:serverTimestamp()},{merge:true});
        alert(newSt==='aprovado' ? "✅ Serviço adicionado!\nVocê continua online." : "✅ Perfil enviado para análise.");
        document.getElementById('provider-setup-modal').classList.add('hidden');
        if(newSt==='em_analise'){ const t = document.getElementById('online-toggle'); if(t){t.checked=false;t.disabled=true;} document.getElementById('status-label').innerText="🟡 EM ANÁLISE"; }
    } catch(e){alert("Erro: "+e.message);} finally{if(btn){btn.innerText="SALVAR";btn.disabled=false;}} 
};    
window.removerServico = async (i) => { const ref = doc(db, "active_providers", auth.currentUser.uid); const snap = await getDoc(ref); let s = snap.data().services; s.splice(i,1); await updateDoc(ref, {services: s}); window.abrirConfiguracaoServicos(); };
window.uploadFotoPerfil = async (i) => { if (!i.files || i.files.length === 0) return; const f = i.files[0]; const u = auth.currentUser; if(!u) return; try { const sRef = ref(storage, `perfil/${u.uid}/foto.jpg`); await uploadBytes(sRef, f); const url = await getDownloadURL(sRef); await updateProfile(u, {photoURL:url}); await updateDoc(doc(db,"usuarios",u.uid),{photoURL:url}); alert("✅ Foto atualizada!"); location.reload(); } catch(e){ alert("Erro upload."); } };
function toggleDisplay(id, s) { const el = document.getElementById(id); if(el) s ? el.classList.remove('hidden') : el.classList.add('hidden'); }

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
