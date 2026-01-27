import { auth, db } from './app.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot, collection, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const storage = getStorage();

// --- CONSTANTES ---
const TAXA_PLATAFORMA = 0.10; // 10%
const CATEGORIAS_SERVICOS = ['Limpeza', 'Obras', 'Técnica', 'Frete', 'Beleza', 'Aulas', 'Outros'];
let userProfile = null;
let radarUnsubscribe = null;

// ============================================================================
// 1. SISTEMA DE LOGIN E PERFIL (CORRIGIDO)
// ============================================================================

window.loginGoogle = async function() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                email: user.email,
                name: user.displayName,
                photoURL: user.photoURL,
                role: 'pending',
                created_at: serverTimestamp(),
                wallet_balance: 0.00
            });
            mostrarSelecaoPerfil();
        } else {
            const userData = userSnap.data();
            if (!userData.role || userData.role === 'pending') {
                mostrarSelecaoPerfil();
            } else {
                iniciarAppLogado(userData);
            }
        }
    } catch (error) {
        console.error("Erro Login:", error);
        alert("Erro ao entrar: " + error.message);
    }
};

window.logout = function() {
    if(radarUnsubscribe) radarUnsubscribe();
    signOut(auth).then(() => window.location.reload());
};

window.definirPerfil = async function(perfil) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await updateDoc(doc(db, "users", user.uid), { role: perfil });
        window.location.reload();
    } catch (e) { console.error(e); }
};

window.alternarPerfil = async function() {
    const user = auth.currentUser;
    if (!user || !userProfile) return;
    
    const novaRole = userProfile.role === 'cliente' ? 'prestador' : 'cliente';
    const btn = document.getElementById('btn-trocar-perfil');
    if(btn) btn.innerHTML = "🔄 Trocando...";
    
    try {
        await updateDoc(doc(db, "users", user.uid), { role: novaRole });
        window.location.reload();
    } catch (e) {
        console.error(e);
        alert("Erro ao trocar perfil.");
    }
};

// Monitoramento de Auth
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
            userProfile = userSnap.data();
            if (userProfile.role && userProfile.role !== 'pending') {
                iniciarAppLogado(userProfile);
            } else {
                mostrarSelecaoPerfil();
            }
        } else {
            mostrarSelecaoPerfil();
        }
    } else {
        mostrarLogin();
    }
});

// --- FUNÇÕES DE UI ---
function mostrarLogin() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.add('hidden');
}

function mostrarSelecaoPerfil() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('role-selection').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
}

function iniciarAppLogado(dados) {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    // Atualiza Header
    const user = auth.currentUser;
    if(user) {
        const els = ['header-user-name', 'provider-header-name'];
        const pics = ['header-user-pic', 'provider-header-pic', 'public-profile-photo'];
        els.forEach(id => { const el = document.getElementById(id); if(el) el.innerText = user.displayName; });
        pics.forEach(id => { const el = document.getElementById(id); if(el) el.src = user.photoURL; });
    }

    // Atualiza Saldo
    const saldoEl = document.getElementById('user-balance');
    if(saldoEl && dados.wallet_balance !== undefined) {
        saldoEl.innerText = dados.wallet_balance.toFixed(2).replace('.', ',');
    }

    // Configura UI por Role
    const viewCliente = document.getElementById('servicos-cliente');
    const viewPrestador = document.getElementById('servicos-prestador');
    const tabServicos = document.getElementById('tab-servicos');

    if (dados.role === 'prestador') {
        if(viewCliente) viewCliente.classList.add('hidden');
        if(viewPrestador) viewPrestador.classList.remove('hidden');
        if(tabServicos) tabServicos.innerHTML = "Meu Painel 🛠️";
        
        verificarStatusERadar(); // <--- RESTAURADO
    } else {
        if(viewPrestador) viewPrestador.classList.add('hidden');
        if(viewCliente) viewCliente.classList.remove('hidden');
        if(tabServicos) tabServicos.innerHTML = "Serviços 🛠️";
        
        if(window.carregarServicos) window.carregarServicos();
    }
}

// ============================================================================
// 2. FUNCIONALIDADES DO PRESTADOR (RESTAURADAS)
// ============================================================================

// A. Radar e Status
async function verificarStatusERadar() {
    const user = auth.currentUser;
    if(!user) return;

    // Listener no active_providers para ver se está online
    onSnapshot(doc(db, "active_providers", user.uid), (docSnap) => {
        const toggle = document.getElementById('online-toggle');
        const statusLabel = document.getElementById('status-label');
        const container = document.getElementById('status-toggle-container');
        
        if(container) container.classList.remove('hidden');

        if (docSnap.exists() && docSnap.data().is_online) {
            if(toggle) toggle.checked = true;
            if(statusLabel) { statusLabel.innerText = "ONLINE"; statusLabel.className = "text-[8px] font-bold text-green-500 uppercase mr-2"; }
            iniciarRadarPrestador();
        } else {
            if(toggle) toggle.checked = false;
            if(statusLabel) { statusLabel.innerText = "OFFLINE"; statusLabel.className = "text-[8px] font-bold text-gray-400 uppercase mr-2"; }
            renderizarRadarOffline();
            if(radarUnsubscribe) { radarUnsubscribe(); radarUnsubscribe = null; }
        }
    });

    // Evento do Toggle
    const toggle = document.getElementById('online-toggle');
    if(toggle) {
        toggle.onchange = async function() {
            if(this.checked) {
                // Tenta ficar online (abre config se não tiver serviços)
                const docSnap = await getDoc(doc(db, "active_providers", user.uid));
                if(docSnap.exists() && docSnap.data().services && docSnap.data().services.length > 0) {
                    await updateDoc(doc(db, "active_providers", user.uid), { is_online: true, last_active: serverTimestamp() });
                } else {
                    this.checked = false;
                    alert("Configure seus serviços antes de ficar online.");
                    window.abrirConfiguracaoServicos();
                }
            } else {
                // Fica offline
                await updateDoc(doc(db, "active_providers", user.uid), { is_online: false });
            }
        };
    }
}

function iniciarRadarPrestador() {
    const user = auth.currentUser;
    const radarContainer = document.getElementById('pview-radar');
    if(!radarContainer) return;

    // Escuta pedidos PENDENTES para este prestador
    const q = query(
        collection(db, "orders"),
        where("provider_id", "==", user.uid),
        where("status", "==", "pending")
    );

    radarUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            radarContainer.innerHTML = `
                <div class="animate-pulse">
                    <div class="text-6xl mb-2">📡</div>
                    <p class="text-xs font-bold text-blue-900">Radar Ativo</p>
                    <p class="text-[10px] text-gray-400">Procurando clientes na região...</p>
                </div>`;
        } else {
            radarContainer.innerHTML = "";
            snapshot.forEach(doc => {
                const pedido = doc.data();
                const taxa = pedido.offer_value * TAXA_PLATAFORMA;
                const liquido = pedido.offer_value - taxa;
                
                radarContainer.innerHTML += `
                    <div class="bg-white p-4 rounded-xl shadow-lg border-l-4 border-blue-600 mb-3 text-left animate-fadeIn">
                        <div class="flex justify-between items-start mb-2">
                            <span class="bg-blue-100 text-blue-800 text-[9px] font-black px-2 py-1 rounded uppercase">Novo Pedido</span>
                            <span class="text-xs font-bold text-gray-500">${pedido.service_date} às ${pedido.service_time}</span>
                        </div>
                        <h3 class="font-black text-gray-800 text-sm mb-1">${pedido.service_category}</h3>
                        <p class="text-xs text-gray-500 mb-3 truncate">📍 ${pedido.location}</p>
                        
                        <div class="bg-gray-50 p-2 rounded mb-3 border border-gray-100">
                            <div class="flex justify-between text-[10px] text-gray-400"><span>Oferta:</span><span>R$ ${pedido.offer_value.toFixed(2)}</span></div>
                            <div class="flex justify-between text-[10px] text-red-300"><span>Taxa:</span><span>- R$ ${taxa.toFixed(2)}</span></div>
                            <div class="flex justify-between text-sm font-black text-green-600 mt-1 border-t border-gray-200 pt-1"><span>VOCÊ RECEBE:</span><span>R$ ${liquido.toFixed(2)}</span></div>
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="window.responderPedido('${doc.id}', 'rejected')" class="bg-red-50 text-red-500 font-bold py-2 rounded-lg text-xs hover:bg-red-100">Recusar</button>
                            <button onclick="window.responderPedido('${doc.id}', 'accepted')" class="bg-green-600 text-white font-bold py-2 rounded-lg text-xs shadow-md hover:bg-green-700">ACEITAR</button>
                        </div>
                    </div>
                `;
                // Toca som se for novo
                const audio = document.getElementById('notification-sound');
                if(audio) audio.play().catch(e => {});
            });
        }
    });
}

function renderizarRadarOffline() {
    const radarContainer = document.getElementById('pview-radar');
    if(radarContainer) {
        radarContainer.innerHTML = `
            <div class="opacity-50">
                <div class="text-6xl mb-2 grayscale">💤</div>
                <p class="text-xs font-bold text-gray-400">Você está Offline</p>
                <p class="text-[10px] text-gray-400">Ative o botão acima para receber pedidos.</p>
            </div>`;
    }
}

// B. Ações do Prestador
window.responderPedido = async function(orderId, action) {
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "...";
    btn.disabled = true;

    try {
        if(action === 'accepted') {
            await updateDoc(doc(db, "orders", orderId), { status: "accepted", updated_at: serverTimestamp() });
            // Redireciona para o chat ou aba de ativos
            window.switchProviderSubTab('ativos');
        } else {
            await updateDoc(doc(db, "orders", orderId), { status: "rejected", updated_at: serverTimestamp() });
        }
    } catch (e) {
        alert("Erro: " + e.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// C. Configuração de Serviços e Uploads
window.abrirConfiguracaoServicos = async function() {
    const modal = document.getElementById('provider-setup-modal');
    const content = document.getElementById('provider-setup-content');
    const user = auth.currentUser;
    
    if(!modal || !content || !user) return;

    modal.classList.remove('hidden');
    content.innerHTML = '<div class="loader mx-auto"></div>';

    // Busca dados atuais
    const docRef = doc(db, "active_providers", user.uid);
    const docSnap = await getDoc(docRef);
    let dados = docSnap.exists() ? docSnap.data() : { services: [], bio: "", banner_url: "" };
    
    // Renderiza Form
    let html = `
        <h3 class="font-black text-blue-900 uppercase italic mb-4 text-center">Meu Perfil Profissional</h3>
        
        <div class="mb-4 text-center">
            <p class="text-[9px] font-bold text-gray-400 uppercase mb-2">Foto do Perfil</p>
            <img src="${user.photoURL}" class="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-blue-100">
            <button onclick="document.getElementById('profile-upload').click()" class="text-[10px] text-blue-600 font-bold underline">Alterar Foto</button>
        </div>

        <div class="mb-4">
            <label class="text-[9px] font-bold text-gray-500 uppercase">Banner (Capa)</label>
            <input type="file" onchange="window.uploadBanner(this)" class="w-full text-xs border p-1 rounded">
            ${dados.banner_url ? `<img src="${dados.banner_url}" class="w-full h-20 object-cover mt-2 rounded-lg">` : ''}
        </div>

        <div class="mb-4">
            <label class="text-[9px] font-bold text-gray-500 uppercase">Bio / Apresentação</label>
            <textarea id="setup-bio" class="w-full border p-2 rounded-lg text-xs" rows="2" placeholder="Ex: Especialista em...">${dados.bio || ''}</textarea>
        </div>

        <div class="border-t border-gray-100 pt-4 mb-4">
            <p class="text-[9px] font-bold text-gray-500 uppercase mb-2">Meus Serviços</p>
            <div id="setup-services-list" class="space-y-2 mb-3"></div>
            
            <div class="bg-gray-50 p-2 rounded-lg border border-gray-200">
                <select id="new-svc-cat" class="w-full mb-2 p-1 text-xs rounded border">
                    ${CATEGORIAS_SERVICOS.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <input type="number" id="new-svc-price" placeholder="Preço Base (R$)" class="w-full mb-2 p-1 text-xs rounded border">
                <button onclick="window.addServiceLocal()" class="w-full bg-blue-100 text-blue-700 font-bold py-1 rounded text-xs hover:bg-blue-200">+ Adicionar Serviço</button>
            </div>
        </div>

        <button onclick="window.saveServicesAndGoOnline()" class="w-full bg-green-600 text-white font-bold py-3 rounded-xl uppercase shadow-md hover:bg-green-700">SALVAR E ATIVAR</button>
    `;

    content.innerHTML = html;

    // Renderiza lista de serviços atuais
    window.tempServices = dados.services || [];
    renderizarServicosLocais();
};

window.renderizarServicosLocais = function() {
    const container = document.getElementById('setup-services-list');
    if(!container) return;
    container.innerHTML = "";
    
    window.tempServices.forEach((s, i) => {
        container.innerHTML += `
            <div class="flex justify-between items-center bg-white p-2 rounded border border-gray-100 shadow-sm">
                <div><span class="font-bold text-xs text-blue-900">${s.category}</span> <span class="text-xs text-gray-500">R$ ${s.price}</span></div>
                <button onclick="window.removerServico(${i})" class="text-red-400 font-bold text-xs">&times;</button>
            </div>
        `;
    });
};

window.addServiceLocal = function() {
    const cat = document.getElementById('new-svc-cat').value;
    const price = document.getElementById('new-svc-price').value;
    if(!price) return alert("Digite o preço base.");
    
    window.tempServices.push({ category: cat, price: parseFloat(price) });
    document.getElementById('new-svc-price').value = "";
    renderizarServicosLocais();
};

window.removerServico = function(index) {
    window.tempServices.splice(index, 1);
    renderizarServicosLocais();
};

window.saveServicesAndGoOnline = async function() {
    const user = auth.currentUser;
    const bio = document.getElementById('setup-bio').value;
    const btn = event.target;
    
    if(window.tempServices.length === 0) return alert("Adicione pelo menos um serviço.");
    
    btn.innerText = "Salvando...";
    
    try {
        await setDoc(doc(db, "active_providers", user.uid), {
            uid: user.uid,
            nome_profissional: user.displayName,
            foto_perfil: user.photoURL,
            bio: bio,
            services: window.tempServices,
            is_online: true,
            last_active: serverTimestamp(),
            visibility_score: 100 // Score inicial
        }, { merge: true }); // Merge para não perder o banner se já existir

        document.getElementById('provider-setup-modal').classList.add('hidden');
        alert("✅ Perfil atualizado! Você está online.");
        
        // Força atualização da UI
        const toggle = document.getElementById('online-toggle');
        if(toggle) toggle.checked = true;
        
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar: " + e.message);
    } finally {
        btn.innerText = "SALVAR E ATIVAR";
    }
};

window.uploadBanner = async function(input) {
    const file = input.files[0];
    if(!file) return;
    
    const user = auth.currentUser;
    const storageRef = ref(storage, `banners/${user.uid}_${Date.now()}`);
    
    try {
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        
        await setDoc(doc(db, "active_providers", user.uid), { banner_url: url }, { merge: true });
        
        // Atualiza preview
        const img = input.nextElementSibling; // A imagem está logo depois do input no HTML gerado
        if(img && img.tagName === 'IMG') {
            img.src = url;
        } else {
            // Se não tinha imagem antes, insere
            input.insertAdjacentHTML('afterend', `<img src="${url}" class="w-full h-20 object-cover mt-2 rounded-lg">`);
        }
        
    } catch (e) {
        console.error(e);
        alert("Erro no upload do banner.");
    }
};

window.uploadFotoPerfil = async function(input) {
    const file = input.files[0];
    if(!file) return;

    const user = auth.currentUser;
    const storageRef = ref(storage, `profiles/${user.uid}_${Date.now()}`);

    try {
        // Overlay de loading
        document.getElementById('upload-overlay').classList.remove('hidden');

        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        // Atualiza Auth profile
        // Nota: updateProfile requer importação de firebase-auth, mas vamos focar no Firestore
        // Para simplificar, atualizamos o doc do user e recarregamos
        
        await updateDoc(doc(db, "users", user.uid), { photoURL: url });
        
        // Se for prestador, atualiza na collection pública também
        const provDoc = await getDoc(doc(db, "active_providers", user.uid));
        if(provDoc.exists()) {
            await updateDoc(doc(db, "active_providers", user.uid), { foto_perfil: url });
        }

        window.location.reload();

    } catch (e) {
        console.error(e);
        alert("Erro no upload.");
        document.getElementById('upload-overlay').classList.add('hidden');
    }
};
