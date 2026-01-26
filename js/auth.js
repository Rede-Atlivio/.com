import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const storage = getStorage();
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";

// 💰 CONFIGURAÇÃO FINANCEIRA
const TAXA_PLATAFORMA = 0.20; // 20% de comissão
const LIMITE_CREDITO_NEGATIVO = -60.00; // Bloqueia se a dívida passar disso

export let userProfile = null;
const CATEGORIAS_SERVICOS = [
    "🛠️ Montagem de Móveis", "🛠️ Reparos Elétricos", "🛠️ Instalação de Ventilador", 
    "🛠️ Pintura", "🛠️ Limpeza Residencial", "🛠️ Diarista", "🛠️ Jardinagem", 
    "🛠️ Encanador", "🛠️ Pedreiro", "🛠️ Marido de Aluguel", "🛠️ Conserto de Eletrodoméstico",
    "💻 Design Gráfico", "💻 Edição de Vídeo", "💻 Gestão de Redes Sociais", 
    "💻 Digitação", "💻 Suporte Técnico", "💻 Aulas Particulares", 
    "🚗 Motorista", "🛵 Entregador", "📷 Fotógrafo", "💅 Manicure/Pedicure", "💇 Cabeleireiro(a)", "Outros"
];

// --- LOGIN / LOGOUT ---
window.loginGoogle = () => signInWithPopup(auth, provider).catch(e => alert("Erro login: " + e.message));
window.logout = () => signOut(auth).then(() => location.reload());

// --- GESTÃO DE PERFIL ---
window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { is_provider: tipo === 'prestador', perfil_completo: true });
        location.reload();
    } catch(e) { alert("Erro ao salvar perfil: " + e.message); }
};

window.alternarPerfil = async () => {
    if(!userProfile) return;
    const btn = document.getElementById('btn-trocar-perfil');
    if(btn) { btn.innerText = "🔄 ..."; btn.disabled = true; }
    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { is_provider: !userProfile.is_provider });
        setTimeout(() => location.reload(), 500);
    } catch (e) { alert("Erro: " + e.message); if(btn) btn.disabled = false; }
};

// --- NÚCLEO DE AUTENTICAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        const userRef = doc(db, "usuarios", user.uid);
        onSnapshot(userRef, async (docSnap) => {
            try {
                if(!docSnap.exists()) {
                    const roleInicial = ADMIN_EMAILS.includes(user.email) ? 'admin' : 'user';
                    userProfile = { 
                        email: user.email, displayName: user.displayName, photoURL: user.photoURL,        
                        tenant_id: DEFAULT_TENANT, perfil_completo: false, role: roleInicial, 
                        wallet_balance: 0.00, is_provider: false, created_at: new Date()
                    };
                    await setDoc(userRef, userProfile);
                } else {
                    userProfile = docSnap.data();
                    if (userProfile.wallet_balance === undefined) userProfile.wallet_balance = 0.00;
                    atualizarInterfaceUsuario(userProfile);
                    iniciarAppLogado(user);
                    if (userProfile.is_provider) {
                        verificarStatusERadar(user.uid);
                        if (!userProfile.setup_profissional_ok) document.getElementById('provider-setup-modal')?.classList.remove('hidden');
                    }
                }
            } catch (err) { console.error("Erro perfil:", err); iniciarAppLogado(user); }
        });
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('role-selection').classList.add('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function atualizarInterfaceUsuario(dados) {
    document.querySelectorAll('img[id$="-pic"], #header-user-pic, #provider-header-pic').forEach(img => {
        if(dados.photoURL) img.src = dados.photoURL;
    });
    const nameEl = document.getElementById('header-user-name');
    if(nameEl) nameEl.innerText = dados.displayName || "Usuário";
    const provNameEl = document.getElementById('provider-header-name');
    if(provNameEl) {
        const saldo = dados.wallet_balance || 0;
        const corSaldo = saldo < 0 ? 'text-red-300' : 'text-emerald-300';
        provNameEl.innerHTML = `${dados.nome_profissional || dados.displayName} <br><span class="text-[10px] font-normal text-gray-300">Saldo: <span class="${corSaldo} font-bold">R$ ${saldo.toFixed(2)}</span></span>`;
    }
}

function iniciarAppLogado(user) {
    if(!userProfile || !userProfile.perfil_completo) {
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('role-selection').classList.remove('hidden');
        return;
    }
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    const btnPerfil = document.getElementById('btn-trocar-perfil');
    const isAdmin = ADMIN_EMAILS.some(email => email.toLowerCase() === user.email.toLowerCase().trim());
    if(isAdmin) document.getElementById('tab-admin')?.classList.remove('hidden');

    if (userProfile.is_provider) {
        if(btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN 🔄` : `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        document.getElementById('tab-servicos').innerText = "Serviços 🛠️";
        ['tab-servicos', 'tab-missoes', 'tab-oportunidades', 'tab-ganhar', 'status-toggle-container', 'servicos-prestador'].forEach(id => toggleDisplay(id, true));
        toggleDisplay('servicos-cliente', false);
    } else {
        if(btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN 🔄` : `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;
        document.getElementById('tab-servicos').innerText = "Contratar Serviço 🛠️";
        ['tab-servicos', 'tab-oportunidades', 'tab-loja', 'tab-ganhar', 'servicos-cliente'].forEach(id => toggleDisplay(id, true));
        ['tab-missoes', 'status-toggle-container', 'servicos-prestador'].forEach(id => toggleDisplay(id, false));
    }
}

async function verificarStatusERadar(uid) {
    const toggle = document.getElementById('online-toggle');
    try {
        const snap = await getDoc(doc(db, "active_providers", uid));
        if(snap.exists()) {
            const isOnline = snap.data().is_online;
            if(toggle) toggle.checked = isOnline;
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
        if (novoStatus) { iniciarRadarPrestador(uid); document.getElementById('online-sound')?.play().catch(()=>{}); } 
        else { renderizarRadarOffline(); }
        await updateDoc(doc(db, "active_providers", uid), { is_online: novoStatus });
    }
});

// 5. RADAR "UBER" (MODIFICADO: SEM COBRANÇA NO BOTÃO)
function iniciarRadarPrestador(uid) {
    const radarContainer = document.getElementById('pview-radar');
    if(!radarContainer) return;

    const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "pending"));

    onSnapshot(q, (snap) => {
        const toggle = document.getElementById('online-toggle');
        if(toggle && !toggle.checked) return;
        radarContainer.innerHTML = "";
        
        if (snap.empty) {
            radarContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-10"><div class="relative flex h-32 w-32 items-center justify-center mb-4"><div class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></div><div class="animate-ping absolute inline-flex h-24 w-24 rounded-full bg-blue-500 opacity-40 animation-delay-500"></div><span class="relative inline-flex rounded-full h-16 w-16 bg-white border-4 border-blue-600 items-center justify-center text-3xl shadow-xl z-10">📡</span></div><p class="text-xs font-black uppercase tracking-widest text-blue-900 animate-pulse">Procurando Clientes...</p><p class="text-[9px] text-gray-400 mt-2">Saldo Atual: R$ ${userProfile.wallet_balance?.toFixed(2)}</p></div>`;
            return;
        }

        document.getElementById('notification-sound')?.play().catch(()=>{});
        if(navigator.vibrate) navigator.vibrate([500, 200, 500]);

        snap.forEach(d => {
            const pedido = d.data();
            const taxa = pedido.offer_value * TAXA_PLATAFORMA;
            const liquido = pedido.offer_value - taxa;

            radarContainer.innerHTML += `
                <div class="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl mb-4 border-2 border-blue-500 animate-fadeIn relative overflow-hidden">
                    <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-600 rounded-full blur-2xl opacity-50"></div>
                    <div class="relative z-10 text-center">
                        <div class="bg-blue-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase inline-block mb-3 animate-pulse">Nova Solicitação</div>
                        <h2 class="text-4xl font-black text-white mb-1">R$ ${pedido.offer_value}</h2>
                        <div class="flex justify-center gap-4 text-[10px] text-gray-400 mb-4 bg-slate-800/50 p-2 rounded">
                            <span>Taxa Futura: <b class="text-red-400">-R$ ${taxa.toFixed(2)}</b></span>
                            <span>Seu Lucro: <b class="text-green-400">R$ ${liquido.toFixed(2)}</b></span>
                        </div>
                        <div class="bg-slate-800 p-3 rounded-xl mb-6 text-left border border-slate-700">
                            <p class="font-bold text-sm text-white">👤 ${pedido.client_name}</p>
                            <p class="text-xs text-gray-300">📍 ${pedido.location}</p>
                            <p class="text-xs text-gray-300">📅 ${pedido.service_date} às ${pedido.service_time}</p>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <button onclick="responderPedido('${d.id}', false)" class="bg-slate-700 text-gray-300 py-4 rounded-xl font-black uppercase text-xs hover:bg-slate-600">✖ Recusar</button>
                            <button onclick="responderPedido('${d.id}', true, ${pedido.offer_value})" class="bg-green-500 text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-green-600">✔ ACEITAR</button>
                        </div>
                    </div>
                </div>`;
        });
    });
}

// 🛑 MODIFICADO: NÃO COBRA A TAXA AQUI MAIS!
window.responderPedido = async (orderId, aceitar, valorServico = 0) => {
    if(!aceitar) {
        await updateDoc(doc(db, "orders", orderId), { status: 'rejected' });
    } else {
        const uid = auth.currentUser.uid;
        const userRef = doc(db, "usuarios", uid);

        // 1. CHECAGEM DE CALOTEIRO (Mantida)
        // Só aceita se o saldo ATUAL não estiver estourado
        const snap = await getDoc(userRef);
        const saldoAtual = snap.data().wallet_balance || 0;

        if (saldoAtual <= LIMITE_CREDITO_NEGATIVO) {
            alert(`⛔ CONTA BLOQUEADA!\n\nVocê atingiu o limite de crédito negativo (R$ ${LIMITE_CREDITO_NEGATIVO}).\nSeu saldo atual é R$ ${saldoAtual.toFixed(2)}.\n\nPor favor, recarregue sua carteira para voltar a aceitar serviços.`);
            return;
        }

        // 2. ACEITA SEM COBRAR (Mudança aqui)
        try {
            await updateDoc(doc(db, "orders", orderId), { status: 'accepted' });
            
            // Ativa chat se não existir
            getDoc(doc(db, "chats", orderId)).then(async (snapChat) => {
                 if(snapChat.exists()) await updateDoc(snapChat.ref, { status: "active" });
            }).catch(async () => {
                 await updateDoc(doc(db, "chats", orderId), { status: "active" });
            });

            // Feedback diferente
            alert(`✅ Pedido Aceito!\n\nCombine os detalhes no Chat.\nA taxa só será descontada quando você FINALIZAR o serviço.`);
            window.switchTab('chat');
            
        } catch (e) { alert("Erro: " + e.message); }
    }
};

// Funções utilitárias mantidas (Upload, Toggle, etc)
window.uploadFotoPerfil = async (input) => { if (!input.files || input.files.length === 0) return; const file = input.files[0]; const user = auth.currentUser; if (!user) return; const overlay = document.getElementById('upload-overlay'); if(overlay) overlay.classList.remove('hidden'); try { const storageRef = ref(storage, `perfil/${user.uid}/foto_perfil.jpg`); await uploadBytes(storageRef, file); const downloadURL = await getDownloadURL(storageRef); await updateProfile(user, { photoURL: downloadURL }); await updateDoc(doc(db, "usuarios", user.uid), { photoURL: downloadURL }); const activeRef = doc(db, "active_providers", user.uid); getDoc(activeRef).then(snap => { if(snap.exists()) updateDoc(activeRef, { foto_perfil: downloadURL }); }); document.querySelectorAll('img[id$="-pic"], #header-user-pic, #provider-header-pic').forEach(img => img.src = downloadURL); alert("✅ Foto atualizada!"); } catch (error) { console.error(error); alert("Erro no upload."); } finally { if(overlay) overlay.classList.add('hidden'); input.value = ""; } };
window.abrirConfiguracaoServicos = async () => { document.getElementById('provider-setup-modal')?.classList.remove('hidden'); const lista = document.getElementById('my-services-list'); if(!lista) return; lista.innerHTML = "Carregando..."; const snap = await getDoc(doc(db, "active_providers", auth.currentUser.uid)); lista.innerHTML = ""; if(snap.exists() && snap.data().services) { snap.data().services.forEach((s,i) => lista.innerHTML += `<div class="bg-gray-50 p-2 mb-1 flex justify-between"><span>${s.category}</span><button onclick="removerServico(${i})" class="text-red-500">x</button></div>`); } };
window.addServiceLocal = async () => { const cat = document.getElementById('new-service-category').value; const price = document.getElementById('new-service-price').value; if(!cat || !price) return; const ref = doc(db, "active_providers", auth.currentUser.uid); const snap = await getDoc(ref); let svcs = snap.exists() ? snap.data().services || [] : []; svcs.push({category: cat, price: parseFloat(price)}); await (snap.exists() ? updateDoc(ref, {services: svcs}) : setDoc(ref, {uid: auth.currentUser.uid, services: svcs, is_online: true})); window.abrirConfiguracaoServicos(); };
window.removerServico = async (i) => { const ref = doc(db, "active_providers", auth.currentUser.uid); const snap = await getDoc(ref); let s = snap.data().services; s.splice(i,1); await updateDoc(ref, {services: s}); window.abrirConfiguracaoServicos(); };
window.saveServicesAndGoOnline = async () => { document.getElementById('provider-setup-modal').classList.add('hidden'); location.reload(); };
function toggleDisplay(id, show) { const el = document.getElementById(id); if(el) show ? el.classList.remove('hidden') : el.classList.add('hidden'); }
