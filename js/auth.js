import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const storage = getStorage();
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";

// 💰 CONFIGURAÇÃO FINANCEIRA
const TAXA_PLATAFORMA = 0.20; 
const LIMITE_CREDITO_NEGATIVO = -60.00; 

// --- EXPOSIÇÃO GLOBAL CRÍTICA ---
export let userProfile = null;
window.userProfile = null; // Correção para o request.js enxergar

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
                    
                    // 🔥 CORREÇÃO: EXPOR GLOBALMENTE 🔥
                    window.userProfile = userProfile; 
                    
                    if (userProfile.wallet_balance === undefined) userProfile.wallet_balance = 0.00;
                    
                    atualizarInterfaceUsuario(userProfile);
                    iniciarAppLogado(user);
                    
                    if (userProfile.is_provider) {
                        verificarStatusERadar(user.uid);
                        if (!userProfile.setup_profissional_ok) window.abrirConfiguracaoServicos();
                    }
                }
            } catch (err) { console.error("Erro perfil:", err); iniciarAppLogado(user); }
        });
    } else {
        window.userProfile = null;
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
            const data = snap.data();
            const isOnline = data.is_online && data.status === 'aprovado';
            
            if(toggle) {
                toggle.checked = isOnline;
                if(data.status === 'em_analise') {
                    toggle.disabled = true;
                    document.getElementById('status-label').innerText = "🟡 EM ANÁLISE";
                } else {
                    toggle.disabled = false;
                    document.getElementById('status-label').innerText = isOnline ? "ONLINE" : "OFFLINE";
                }
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
        if(snap.exists() && snap.data().status === 'em_analise') {
            e.target.checked = false;
            return alert("⏳ Seu perfil está em análise.\nAguarde a aprovação para ficar online.");
        }

        if (novoStatus) { iniciarRadarPrestador(uid); document.getElementById('online-sound')?.play().catch(()=>{}); } 
        else { renderizarRadarOffline(); }
        await updateDoc(doc(db, "active_providers", uid), { is_online: novoStatus });
    }
});

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
                    <div class="relative z-10 text-center">
                        <div class="bg-blue-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase inline-block mb-3 animate-pulse">Nova Solicitação</div>
                        <h2 class="text-4xl font-black text-white mb-1">R$ ${pedido.offer_value}</h2>
                        <div class="flex justify-center gap-4 text-[10px] text-gray-400 mb-4 bg-slate-800/50 p-2 rounded"><span>Taxa Futura: <b class="text-red-400">-R$ ${taxa.toFixed(2)}</b></span><span>Seu Lucro: <b class="text-green-400">R$ ${liquido.toFixed(2)}</b></span></div>
                        <div class="bg-slate-800 p-3 rounded-xl mb-6 text-left border border-slate-700"><p class="font-bold text-sm text-white">👤 ${pedido.client_name}</p><p class="text-xs text-gray-300">📍 ${pedido.location}</p><p class="text-xs text-gray-300">📅 ${pedido.service_date} às ${pedido.service_time}</p></div>
                        <div class="grid grid-cols-2 gap-3"><button onclick="responderPedido('${d.id}', false)" class="bg-slate-700 text-gray-300 py-4 rounded-xl font-black uppercase text-xs hover:bg-slate-600">✖ Recusar</button><button onclick="responderPedido('${d.id}', true, ${pedido.offer_value})" class="bg-green-500 text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-green-600">✔ ACEITAR</button></div>
                    </div>
                </div>`;
        });
    });
}

window.responderPedido = async (orderId, aceitar, valorServico = 0) => {
    if(!aceitar) {
        await updateDoc(doc(db, "orders", orderId), { status: 'rejected' });
    } else {
        const uid = auth.currentUser.uid;
        const userRef = doc(db, "usuarios", uid);
        const snap = await getDoc(userRef);
        const saldoAtual = snap.data().wallet_balance || 0;
        if (saldoAtual <= LIMITE_CREDITO_NEGATIVO) return alert(`⛔ LIMITE EXCEDIDO (R$ ${LIMITE_CREDITO_NEGATIVO}).\nSaldo atual: R$ ${saldoAtual.toFixed(2)}.\nRecarregue para continuar.`);
        try {
            await updateDoc(doc(db, "orders", orderId), { status: 'accepted' });
            getDoc(doc(db, "chats", orderId)).then(async (snapChat) => { if(snapChat.exists()) await updateDoc(snapChat.ref, { status: "active" }); }).catch(async () => { await updateDoc(doc(db, "chats", orderId), { status: "active" }); });
            alert(`✅ Pedido Aceito!`);
            if (window.irParaChat) window.irParaChat(); else { document.getElementById('tab-chat').click(); setTimeout(() => { if(window.carregarChat) window.carregarChat(); }, 500); }
        } catch (e) { alert("Erro: " + e.message); }
    }
};

// ============================================================================
// 🎨 ÁREA DE CONFIGURAÇÃO DE PERFIL (VITRINE) - RESTAURADA COM SEGURANÇA
// ============================================================================

window.uploadBanner = async (input) => {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const user = auth.currentUser;
    if(file.size > 500000) alert("⚠️ Imagem grande! Recomendado: menos de 500kb para carregar rápido.");
    const btn = document.getElementById('btn-upload-banner');
    const originalText = btn.innerText;
    btn.innerText = "Enviando...";
    btn.disabled = true;
    try {
        const storageRef = ref(storage, `banners/${user.uid}/capa_vitrine.jpg`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        document.getElementById('hidden-banner-url').value = downloadURL;
        document.getElementById('preview-banner').src = downloadURL;
        document.getElementById('preview-banner').classList.remove('hidden');
        document.getElementById('banner-placeholder').classList.add('hidden');
        alert("✅ Banner carregado! Clique em 'SALVAR E ENVIAR' no final para confirmar.");
    } catch (error) {
        console.error(error);
        alert("Erro no upload do banner.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.abrirConfiguracaoServicos = async () => {
    const modal = document.getElementById('provider-setup-modal');
    modal.classList.remove('hidden');
    
    // Tenta encontrar o container específico ou usa o genérico
    const content = document.getElementById('provider-setup-content');
    const formContainer = content || modal.querySelector('div.bg-white') || modal.firstElementChild;
    
    let dados = {};
    try {
        const docSnap = await getDoc(doc(db, "active_providers", auth.currentUser.uid));
        if(docSnap.exists()) dados = docSnap.data();
    } catch(e){}
    
    const bannerAtual = dados.banner_url || "";
    const bioAtual = dados.bio || "";
    const servicosAtuais = dados.services || [];

    formContainer.innerHTML = `
        <div class="p-6 h-[80vh] overflow-y-auto">
            <h2 class="text-xl font-black text-blue-900 mb-1">🚀 Seu Perfil Profissional</h2>
            <p class="text-xs text-gray-500 mb-6">Capriche! Essa é sua loja dentro do app.</p>
            <div class="mb-6">
                <label class="block text-xs font-bold text-gray-700 uppercase mb-2">📸 Foto de Capa (Banner)</label>
                <div class="relative w-full h-32 bg-gray-100 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center group cursor-pointer" onclick="document.getElementById('banner-input').click()">
                    <img id="preview-banner" src="${bannerAtual}" class="${bannerAtual ? '' : 'hidden'} w-full h-full object-cover">
                    <div id="banner-placeholder" class="${bannerAtual ? 'hidden' : 'flex'} flex-col items-center">
                        <span class="text-2xl">🖼️</span><span class="text-[10px] text-gray-400">Toque para adicionar</span>
                    </div>
                    <div class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white text-xs font-bold">Trocar Imagem</div>
                </div>
                <input type="file" id="banner-input" accept="image/*" class="hidden" onchange="window.uploadBanner(this)">
                <input type="hidden" id="hidden-banner-url" value="${bannerAtual}">
                <p id="btn-upload-banner" class="text-[9px] text-center mt-1 text-gray-400">Recomendado: 1200x400px (Horizontal)</p>
            </div>
            <div class="mb-6 space-y-3">
                <div><label class="inp-label">Nome Profissional</label><input type="text" id="setup-name" value="${dados.nome_profissional || auth.currentUser.displayName || ''}" class="inp-editor" placeholder="Ex: João Eletricista"></div>
                <div><label class="inp-label">Bio (Quem é você?)</label><textarea id="setup-bio" rows="3" class="inp-editor" placeholder="Ex: Especialista em elétrica residencial com 5 anos de experiência. Trabalho rápido e limpo.">${bioAtual}</textarea></div>
            </div>
            <div class="mb-6">
                <label class="block text-xs font-bold text-gray-700 uppercase mb-2">🛠️ Seus Serviços</label>
                <div id="my-services-list" class="mb-3 space-y-2">
                    ${servicosAtuais.map((s, i) => `<div class="bg-blue-50 p-3 rounded border border-blue-100 flex justify-between items-center"><div><p class="font-bold text-xs text-blue-900">${s.category}</p><p class="text-[10px] text-gray-500">R$ ${s.price}</p></div><button onclick="removerServico(${i})" class="text-red-500 font-bold px-2">x</button></div>`).join('')}
                    ${servicosAtuais.length === 0 ? '<p class="text-xs text-gray-400 italic text-center py-2">Nenhum serviço adicionado.</p>' : ''}
                </div>
                <div class="bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <p class="text-[10px] font-bold text-gray-500 uppercase mb-2">Adicionar Novo</p>
                    <div class="grid grid-cols-2 gap-2 mb-2">
                        <select id="new-service-category" class="inp-editor"><option value="" disabled selected>Categoria...</option>${CATEGORIAS_SERVICOS.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
                        <input type="number" id="new-service-price" placeholder="Preço (R$)" class="inp-editor">
                    </div>
                    <textarea id="new-service-desc" placeholder="Detalhes (Ex: Incluso material?)" class="inp-editor mb-2" rows="1"></textarea>
                    <button onclick="window.addServiceLocal()" class="w-full bg-slate-700 text-white py-2 rounded text-xs font-bold uppercase">Adicionar Serviço</button>
                </div>
            </div>
            <div class="pt-4 border-t border-gray-100">
                <button onclick="window.saveServicesAndGoOnline()" class="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black text-sm uppercase shadow-lg transform active:scale-95 transition">💾 SALVAR E ENVIAR</button>
                <p class="text-[10px] text-center text-gray-400 mt-2">Seu perfil será analisado pela equipe Atlivio.</p>
            </div>
        </div>
    `;
};

window.addServiceLocal = async () => {
    const cat = document.getElementById('new-service-category').value;
    const price = document.getElementById('new-service-price').value;
    const desc = document.getElementById('new-service-desc').value;
    if (!cat || !price) return alert("Preencha categoria e preço.");
    const ref = doc(db, "active_providers", auth.currentUser.uid);
    const snap = await getDoc(ref);
    let svcs = snap.exists() ? snap.data().services || [] : [];
    svcs.push({ category: cat, price: parseFloat(price), description: desc });
    const dadosBase = snap.exists() ? {} : { uid: auth.currentUser.uid, created_at: serverTimestamp(), is_online: false, status: 'em_analise', visibility_score: 100 };
    await setDoc(ref, { ...dadosBase, services: svcs }, { merge: true });
    window.abrirConfiguracaoServicos();
};

window.saveServicesAndGoOnline = async () => {
    const nome = document.getElementById('setup-name').value;
    const bio = document.getElementById('setup-bio').value;
    const banner = document.getElementById('hidden-banner-url').value;
    
    if(!nome) return alert("O nome profissional é obrigatório.");
    if(!bio) return alert("Escreva uma bio curta sobre você.");
    if(!banner) { if(!confirm("Tem certeza que quer enviar SEM foto de capa?")) return; }

    const btn = document.querySelector('button[onclick="window.saveServicesAndGoOnline()"]');
    if(btn) { btn.innerText = "ENVIANDO..."; btn.disabled = true; }

    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { nome_profissional: nome, setup_profissional_ok: true });
        const activeRef = doc(db, "active_providers", auth.currentUser.uid);
        await setDoc(activeRef, { 
            uid: auth.currentUser.uid, 
            nome_profissional: nome, 
            foto_perfil: userProfile.photoURL, 
            bio: bio, 
            banner_url: banner, 
            is_online: false, 
            status: 'em_analise', 
            updated_at: serverTimestamp() 
        }, { merge: true });

        alert("✅ PERFIL ENVIADO PARA ANÁLISE!");
        
        const modal = document.getElementById('provider-setup-modal');
        if(modal) modal.classList.add('hidden');
        
        const toggle = document.getElementById('online-toggle');
        const label = document.getElementById('status-label');
        
        if(toggle) { toggle.checked = false; toggle.disabled = true; }
        if(label) label.innerText = "🟡 EM ANÁLISE";

    } catch(e) { 
        alert("Erro: " + e.message); 
        if(btn) { btn.innerText = "SALVAR E ENVIAR"; btn.disabled = false; }
    }
};

window.removerServico = async (i) => { 
    const ref = doc(db, "active_providers", auth.currentUser.uid); 
    const snap = await getDoc(ref); 
    let s = snap.data().services; 
    s.splice(i,1); 
    await updateDoc(ref, {services: s}); 
    window.abrirConfiguracaoServicos(); 
};

window.uploadFotoPerfil = async (input) => { 
    if (!input.files || input.files.length === 0) return; 
    const file = input.files[0]; 
    const user = auth.currentUser; 
    if (!user) return; 
    const overlay = document.getElementById('upload-overlay'); 
    if(overlay) overlay.classList.remove('hidden'); 
    try { 
        const storageRef = ref(storage, `perfil/${user.uid}/foto_perfil.jpg`); 
        await uploadBytes(storageRef, file); 
        const downloadURL = await getDownloadURL(storageRef); 
        await updateProfile(user, { photoURL: downloadURL }); 
        await updateDoc(doc(db, "usuarios", user.uid), { photoURL: downloadURL }); 
        const activeRef = doc(db, "active_providers", user.uid); 
        getDoc(activeRef).then(snap => { if(snap.exists()) updateDoc(activeRef, { foto_perfil: downloadURL }); }); 
        document.querySelectorAll('img[id$="-pic"], #header-user-pic, #provider-header-pic').forEach(img => img.src = downloadURL); 
        alert("✅ Foto atualizada!"); 
    } catch (error) { console.error(error); alert("Erro no upload."); } 
    finally { if(overlay) overlay.classList.add('hidden'); input.value = ""; } 
};

function toggleDisplay(id, show) { const el = document.getElementById(id); if(el) show ? el.classList.remove('hidden') : el.classList.add('hidden'); }
