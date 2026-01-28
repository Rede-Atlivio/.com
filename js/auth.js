import { auth, db, provider } from './app.js';
import { signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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

// --- LOGIN / LOGOUT ---
window.loginGoogle = () => { console.log("🔄 Login..."); signInWithRedirect(auth, provider); };
window.logout = () => signOut(auth).then(() => location.reload());

getRedirectResult(auth).then((result) => { if (result) console.log("✅ Login OK."); }).catch((error) => console.error("❌ Erro Login:", error));

// --- PERFIL ---
window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    try { await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { is_provider: tipo === 'prestador', perfil_completo: true }); location.reload(); } catch(e) { alert("Erro: " + e.message); }
};
window.alternarPerfil = async () => {
    if(!userProfile) return;
    const btn = document.getElementById('btn-trocar-perfil');
    if(btn) { btn.innerText = "🔄 ..."; btn.disabled = true; }
    try { await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { is_provider: !userProfile.is_provider }); setTimeout(() => location.reload(), 500); } catch (e) { alert("Erro: " + e.message); if(btn) btn.disabled = false; }
};

// --- ENFORCER & CORE ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        const userRef = doc(db, "usuarios", user.uid);
        onSnapshot(userRef, async (docSnap) => {
            try {
                if(!docSnap.exists()) {
                    const novoPerfil = { 
                        email: user.email, phone: user.phoneNumber, displayName: user.displayName || "Usuário", 
                        photoURL: user.photoURL, tenant_id: DEFAULT_TENANT, perfil_completo: false, 
                        role: (user.email && ADMIN_EMAILS.includes(user.email)) ? 'admin' : 'user', 
                        wallet_balance: 0.00, saldo: 0.00, is_provider: false, created_at: new Date(), status: 'ativo'
                    };
                    userProfile = novoPerfil; window.userProfile = novoPerfil;
                    await setDoc(userRef, novoPerfil);
                } else {
                    const data = docSnap.data();
                    
                    if (data.status === 'banido') console.warn("🚫 BANIDO.");
                    if (data.status === 'suspenso' && data.is_online) updateDoc(doc(db, "active_providers", user.uid), { is_online: false });
                    
                    data.wallet_balance = data.saldo !== undefined ? data.saldo : (data.wallet_balance || 0);
                    userProfile = data; window.userProfile = data;
                    
                    aplicarRestricoesDeStatus(data.status);
                    renderizarBotaoSuporte(); // Botão Flutuante

                    if(data.status !== 'banido') {
                        atualizarInterfaceUsuario(userProfile);
                        iniciarAppLogado(user); 
                        if (userProfile.is_provider) {
                            verificarStatusERadar(user.uid);
                            if (!userProfile.setup_profissional_ok) window.abrirConfiguracaoServicos();
                        }
                    }
                }
            } catch (err) { console.error("Erro perfil:", err); iniciarAppLogado(user); }
        });
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('role-selection').classList.add('hidden');
        document.getElementById('app-container').classList.add('hidden');
        removerBloqueiosVisuais();
    }
});

// --- SISTEMA DE SUPORTE (ATUALIZADO PARA CORRIGIR LOADING) ---
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
            <div id="modal-support-chat" class="fixed inset-0 z-[210] bg-black/50 hidden flex items-end sm:items-center justify-center animate-fadeIn">
                <div class="bg-white w-full sm:w-96 h-[85vh] sm:h-[600px] sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                    <div class="bg-blue-900 p-4 text-white flex justify-between items-center shadow-md z-10">
                        <div><h3 class="font-bold text-lg flex items-center gap-2">🛟 Suporte Atlivio</h3><p class="text-[10px] text-blue-200">Estamos aqui para ajudar.</p></div>
                        <button onclick="document.getElementById('modal-support-chat').classList.add('hidden')" class="text-white/80 hover:text-white font-bold text-2xl">&times;</button>
                    </div>
                    <div id="support-alert-box" class="bg-amber-50 p-3 border-b border-amber-100 text-amber-800 text-[10px] flex gap-2 items-start hidden">
                        <span class="text-lg">⏳</span><p><b>Atenção:</b> Nossa equipe é pequena. Descreva <b>tudo</b> em uma única mensagem.<br>Prazo de resposta: <b>24h a 48h</b>.</p>
                    </div>
                    <div id="support-messages" class="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-3">
                        <div class="flex flex-col items-center justify-center h-full opacity-50"><div class="loader border-t-blue-500 w-8 h-8 mb-2"></div><p class="text-xs">Conectando...</p></div>
                    </div>
                    <div class="p-3 bg-white border-t flex gap-2 items-end">
                        <textarea id="support-input" rows="1" class="flex-1 border border-gray-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none max-h-24 text-gray-900" placeholder="Descreva seu problema aqui..."></textarea>
                        <button onclick="window.enviarMensagemSuporte()" class="bg-blue-600 hover:bg-blue-700 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition transform active:scale-95 mb-1">➤</button>
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('modal-support-chat');
    }
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('support-input').focus(), 500);
    carregarMensagensSuporte();
};

let unsubscribeSuporte = null;
function carregarMensagensSuporte() {
    const container = document.getElementById('support-messages');
    const alertBox = document.getElementById('support-alert-box');
    const uid = auth.currentUser.uid;
    
    if(unsubscribeSuporte) unsubscribeSuporte();

    const q = query(collection(db, "support_tickets"), where("uid", "==", uid), orderBy("created_at", "asc"));
    
    unsubscribeSuporte = onSnapshot(q, (snap) => {
        container.innerHTML = "";
        
        if(snap.empty) {
            if(alertBox) alertBox.classList.remove('hidden');
            container.innerHTML = `<div class="text-center py-10 px-6"><div class="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">👋</div><h3 class="font-bold text-gray-700 mb-2">Olá, ${userProfile?.displayName?.split(' ')[0] || 'Visitante'}!</h3><p class="text-xs text-gray-500 leading-relaxed">Ainda não temos conversas.<br>Use o campo abaixo para relatar seu problema.<br>Seja detalhista para agilizar o atendimento.</p></div>`;
            return;
        } 
        
        if(alertBox) alertBox.classList.add('hidden'); 

        snap.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.sender === 'user';
            const isSystem = msg.sender === 'system' || msg.system_msg;
            
            let bubbleHtml = '';
            if (isSystem) {
                bubbleHtml = `<div class="flex justify-center my-4 opacity-75"><span class="bg-gray-200 text-gray-600 text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">${msg.message}</span></div>`;
            } else {
                bubbleHtml = `<div class="flex ${isMe ? 'justify-end' : 'justify-start'} animate-fadeIn"><div class="${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'} max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm relative"><p>${msg.message}</p><p class="text-[9px] ${isMe ? 'text-blue-200' : 'text-gray-400'} text-right mt-1">${msg.created_at ? msg.created_at.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'} ${isMe ? '✓' : ''}</p></div></div>`;
            }
            container.innerHTML += bubbleHtml;
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
    } catch(e) { alert("Erro ao enviar: " + e.message); }
};

// --- RESTO DO CÓDIGO (Visual, Enforcer, Serviços) ---
function aplicarRestricoesDeStatus(status) {
    const body = document.body;
    const bloqueioID = "bloqueio-total-overlay"; const avisoID = "aviso-suspenso-bar";
    const oldBlock = document.getElementById(bloqueioID); const oldBar = document.getElementById(avisoID);
    if(oldBlock) oldBlock.remove(); if(oldBar) oldBar.remove();

    if (status === 'banido') {
        const jailHtml = `<div id="${bloqueioID}" class="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade"><div class="bg-red-500/10 p-6 rounded-full mb-6 border-4 border-red-500 animate-pulse"><span class="text-6xl">🚫</span></div><h1 class="text-3xl font-black text-white mb-2">CONTA BLOQUEADA</h1><p class="text-gray-400 mb-8 max-w-md">Violação dos termos de uso.</p><button onclick="window.abrirChatSuporte()" class="bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-lg animate-bounce">Falar com Suporte</button><button onclick="window.logout()" class="text-gray-500 text-xs mt-4 underline">Sair</button></div>`;
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
    document.querySelectorAll('img[id$="-pic"], #header-user-pic, #provider-header-pic').forEach(img => { if(dados.photoURL) img.src = dados.photoURL; });
    const nameEl = document.getElementById('header-user-name'); if(nameEl) nameEl.innerText = dados.displayName || "Usuário";
    const provNameEl = document.getElementById('provider-header-name');
    if(provNameEl) {
        const saldo = dados.wallet_balance || 0; const corSaldo = saldo < 0 ? 'text-red-300' : 'text-emerald-300';
        provNameEl.innerHTML = `${dados.nome_profissional || dados.displayName} <br><span class="text-[10px] font-normal text-gray-300">Saldo: <span class="${corSaldo} font-bold">R$ ${saldo.toFixed(2)}</span></span>`;
    }
}

function iniciarAppLogado(user) {
    if(!userProfile || !userProfile.perfil_completo) { document.getElementById('app-container').classList.add('hidden'); document.getElementById('role-selection').classList.remove('hidden'); return; }
    document.getElementById('role-selection').classList.add('hidden'); document.getElementById('app-container').classList.remove('hidden');
    const btnPerfil = document.getElementById('btn-trocar-perfil');
    const userEmail = user.email ? user.email.toLowerCase().trim() : "";
    const isAdmin = userEmail && ADMIN_EMAILS.some(adm => adm.toLowerCase() === userEmail);
    if(isAdmin) document.getElementById('tab-admin')?.classList.remove('hidden');

    if (userProfile.is_provider) {
        if(btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN` : `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        document.getElementById('tab-servicos').innerText = "Serviços 🛠️";
        ['tab-servicos', 'tab-missoes', 'tab-oportunidades', 'tab-ganhar', 'status-toggle-container', 'servicos-prestador'].forEach(id => toggleDisplay(id, true));
        toggleDisplay('servicos-cliente', false);
        setTimeout(() => { document.getElementById('tab-servicos')?.click(); }, 1000);
    } else {
        if(btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN` : `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;
        document.getElementById('tab-servicos').innerText = "Contratar 🛠️";
        ['tab-servicos', 'tab-oportunidades', 'tab-loja', 'tab-ganhar', 'servicos-cliente'].forEach(id => toggleDisplay(id, true));
        ['tab-missoes', 'status-toggle-container', 'servicos-prestador'].forEach(id => toggleDisplay(id, false));
        setTimeout(() => { 
            const tab = document.getElementById('tab-servicos'); if(tab) tab.click(); else if(window.carregarServicos) window.carregarServicos();
            if(window.carregarVagas) window.carregarVagas(); if(window.carregarOportunidades) window.carregarOportunidades();
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

function renderizarRadarOffline() {
    const radar = document.getElementById('pview-radar');
    if(radar) radar.innerHTML = `<div class="flex flex-col items-center justify-center py-12 opacity-60 grayscale"><div class="text-5xl mb-3">💤</div><p class="text-xs font-black uppercase tracking-widest text-gray-400">Você está Offline</p></div>`;
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
        if (novoStatus) { iniciarRadarPrestador(uid); document.getElementById('online-sound')?.play().catch(()=>{}); } 
        else { renderizarRadarOffline(); }
        await updateDoc(doc(db, "active_providers", uid), { is_online: novoStatus });
    }
});

function iniciarRadarPrestador(uid) {
    const radarContainer = document.getElementById('pview-radar'); if(!radarContainer) return;
    const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "pending"));
    onSnapshot(q, (snap) => {
        const toggle = document.getElementById('online-toggle'); if(toggle && !toggle.checked) return;
        radarContainer.innerHTML = "";
        if (snap.empty) { radarContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-10"><div class="relative flex h-32 w-32 items-center justify-center mb-4"><div class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></div><div class="animate-ping absolute inline-flex h-24 w-24 rounded-full bg-blue-500 opacity-40 animation-delay-500"></div><span class="relative inline-flex rounded-full h-16 w-16 bg-white border-4 border-blue-600 items-center justify-center text-3xl shadow-xl z-10">📡</span></div><p class="text-xs font-black uppercase tracking-widest text-blue-900 animate-pulse">Procurando Clientes...</p><p class="text-[9px] text-gray-400 mt-2">Saldo Atual: R$ ${userProfile?.wallet_balance?.toFixed(2) || '0.00'}</p></div>`; return; }
        document.getElementById('notification-sound')?.play().catch(()=>{}); if(navigator.vibrate) navigator.vibrate([500, 200, 500]);
        snap.forEach(d => {
            const pedido = d.data(); const taxa = pedido.offer_value * TAXA_PLATAFORMA; const liquido = pedido.offer_value - taxa;
            radarContainer.innerHTML += `<div class="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl mb-4 border-2 border-blue-500 animate-fadeIn relative overflow-hidden"><div class="relative z-10 text-center"><div class="bg-blue-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase inline-block mb-3 animate-pulse">Nova Solicitação</div><h2 class="text-4xl font-black text-white mb-1">R$ ${pedido.offer_value}</h2><div class="flex justify-center gap-4 text-[10px] text-gray-400 mb-4 bg-slate-800/50 p-2 rounded"><span>Taxa Futura: <b class="text-red-400">-R$ ${taxa.toFixed(2)}</b></span><span>Seu Lucro: <b class="text-green-400">R$ ${liquido.toFixed(2)}</b></span></div><div class="bg-slate-800 p-3 rounded-xl mb-6 text-left border border-slate-700"><p class="font-bold text-sm text-white">👤 ${pedido.client_name}</p><p class="text-xs text-gray-300">📍 ${pedido.location}</p><p class="text-xs text-gray-300">📅 ${pedido.service_date} às ${pedido.service_time}</p></div><div class="grid grid-cols-2 gap-3"><button onclick="responderPedido('${d.id}', false)" class="bg-slate-700 text-gray-300 py-4 rounded-xl font-black uppercase text-xs hover:bg-slate-600">✖ Recusar</button><button onclick="responderPedido('${d.id}', true, ${pedido.offer_value})" class="bg-green-500 text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-green-600">✔ ACEITAR</button></div></div></div>`;
        });
    });
}

window.responderPedido = async (orderId, aceitar, valorServico = 0) => {
    if(!aceitar) { await updateDoc(doc(db, "orders", orderId), { status: 'rejected' }); } 
    else {
        if(userProfile?.status === 'suspenso') return alert("⚠️ CONTA SUSPENSA. Você não pode aceitar pedidos.");
        const uid = auth.currentUser.uid; const userRef = doc(db, "usuarios", uid); const snap = await getDoc(userRef);
        const saldoAtual = snap.data().saldo !== undefined ? snap.data().saldo : (snap.data().wallet_balance || 0);
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
    
    // LISTA DE SERVIÇOS
    const servicesHtml = s.length > 0 ? s.map((sv,i)=>`
        <div class="bg-blue-50 p-3 rounded-lg border border-blue-100 flex justify-between items-center mb-2">
            <div><p class="font-bold text-xs text-blue-900 flex items-center gap-1">🛠️ ${sv.category}</p><p class="text-[10px] text-gray-600">R$ ${sv.price}</p></div>
            <div class="flex gap-2">
                <button onclick="window.editarServico(${i})" class="text-blue-500 hover:text-blue-700 p-1 rounded bg-white border border-blue-200" title="Editar">✏️</button>
                <button onclick="window.removerServico(${i})" class="text-red-500 hover:text-red-700 p-1 rounded bg-white border border-red-200" title="Excluir">❌</button>
            </div>
        </div>`).join('') : '<p class="text-xs text-gray-400 italic text-center py-4 border border-dashed border-gray-300 rounded">Nenhum serviço adicionado.</p>';

    form.innerHTML = `
        <div class="p-6 h-[80vh] overflow-y-auto">
            <div class="flex justify-between mb-2"><div><h2 class="text-xl font-black text-blue-900">🚀 Perfil</h2></div><button onclick="document.getElementById('provider-setup-modal').classList.add('hidden')" class="text-gray-400 font-bold text-xl px-2">&times;</button></div>
            <div class="mb-6"><label class="text-xs font-bold text-gray-700 uppercase">📸 Capa</label><div class="relative w-full h-32 bg-gray-100 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer" onclick="document.getElementById('banner-input').click()"><img id="preview-banner" src="${b}" class="${b?'':'hidden'} w-full h-full object-cover"><div id="banner-placeholder" class="${b?'hidden':'flex'} flex-col items-center"><span class="text-2xl">🖼️</span></div></div><input type="file" id="banner-input" class="hidden" onchange="window.uploadBanner(this)"><input type="hidden" id="hidden-banner-url" value="${b}"></div>
            <div class="mb-6 space-y-3"><div><label class="text-xs font-bold text-gray-500 uppercase">Nome</label><input type="text" id="setup-name" value="${d.nome_profissional||auth.currentUser.displayName||''}" class="${inputStyle}"></div><div><label class="text-xs font-bold text-gray-500 uppercase">Bio</label><textarea id="setup-bio" rows="3" class="${inputStyle}">${bi}</textarea></div></div>
            <div class="mb-6"><label class="text-xs font-bold text-gray-700 uppercase block mb-2">🛠️ Seus Serviços</label><div id="my-services-list" class="mb-4">${servicesHtml}</div><div class="bg-gray-100 p-4 rounded-xl border border-gray-200"><p class="text-[10px] font-bold text-gray-500 uppercase mb-2">Adicionar / Editar</p><div class="grid grid-cols-2 gap-2 mb-2"><select id="new-service-category" class="${inputStyle}"><option value="" disabled selected>Categoria...</option>${CATEGORIAS_SERVICOS.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><input type="number" id="new-service-price" placeholder="R$" class="${inputStyle}"></div><textarea id="new-service-desc" placeholder="Detalhes" class="${inputStyle}" rows="1"></textarea><button onclick="window.addServiceLocal()" class="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded text-xs font-bold uppercase mt-3 transition shadow">⬇️ ADICIONAR A LISTA</button></div></div>
            <div class="pt-4 border-t flex gap-2"><button onclick="document.getElementById('provider-setup-modal').classList.add('hidden')" class="flex-1 bg-gray-200 py-4 rounded-xl font-bold text-xs uppercase text-gray-700">Cancelar</button><button onclick="window.saveServicesAndGoOnline()" class="flex-2 w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black text-sm uppercase shadow-lg transform active:scale-95 transition">💾 SALVAR TUDO</button></div>
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
        alert("✏️ ITEM MOVIDO PARA EDIÇÃO.\n\nAltere os dados abaixo e clique em 'ADICIONAR' para confirmar.");
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
