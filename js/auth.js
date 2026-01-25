import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, deleteDoc, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const storage = getStorage();
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";
export let userProfile = null;

// --- LISTA DE CATEGORIAS (Seu pedido) ---
const CATEGORIAS_SERVICOS = [
    "🛠️ Montagem de Móveis", "🛠️ Reparos Elétricos", "🛠️ Instalação de Ventilador", 
    "🛠️ Pintura", "🛠️ Limpeza Residencial", "🛠️ Diarista", "🛠️ Jardinagem", 
    "🛠️ Encanador", "🛠️ Pedreiro", "🛠️ Marido de Aluguel",
    "💻 Design Gráfico", "💻 Edição de Vídeo", "💻 Gestão de Redes Sociais", 
    "💻 Digitação", "💻 Suporte Técnico", "💻 Aulas Particulares", 
    "🚗 Motorista", "🛵 Entregador", "📷 Fotógrafo", "Outros"
];

// --- LOGIN / LOGOUT ---
window.loginGoogle = () => signInWithPopup(auth, provider).catch(e => alert("Erro login: " + e.message));
window.logout = () => signOut(auth).then(() => location.reload());

// --- GESTÃO DE PERFIL ---
window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            is_provider: tipo === 'prestador', 
            perfil_completo: true 
        });
        location.reload();
    } catch(e) { alert("Erro ao salvar perfil: " + e.message); }
};

window.alternarPerfil = async () => {
    if(!userProfile) return;
    const btn = document.getElementById('btn-trocar-perfil');
    if(btn) { btn.innerText = "🔄 ..."; btn.disabled = true; }
    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            is_provider: !userProfile.is_provider 
        });
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
                        email: user.email, 
                        displayName: user.displayName, 
                        photoURL: user.photoURL,        
                        tenant_id: DEFAULT_TENANT, 
                        perfil_completo: false, 
                        role: roleInicial, 
                        saldo: 0, 
                        is_provider: false,
                        created_at: new Date()
                    };
                    await setDoc(userRef, userProfile);
                } else {
                    userProfile = docSnap.data();
                    
                    // Atualiza UI do Header
                    atualizarInterfaceUsuario(userProfile);

                    iniciarAppLogado(user);
                    
                    // Se for prestador, ativa o Radar e a Lista de Serviços
                    if (userProfile.is_provider) {
                        iniciarRadarPrestador(user.uid);
                        if (!userProfile.setup_profissional_ok) {
                            const modal = document.getElementById('provider-setup-modal');
                            if(modal) {
                                modal.classList.remove('hidden');
                                const inputNome = document.getElementById('setup-name');
                                if(inputNome && !inputNome.value) inputNome.value = user.displayName || "";
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Erro crítico perfil:", err);
                iniciarAppLogado(user); 
            }
        });
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('role-selection').classList.add('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
});

function atualizarInterfaceUsuario(dados) {
    // Atualiza fotos e textos em todo o site
    document.querySelectorAll('img[id$="-pic"], #header-user-pic, #provider-header-pic').forEach(img => {
        if(dados.photoURL) img.src = dados.photoURL;
    });
    
    const nameEl = document.getElementById('header-user-name');
    if(nameEl) nameEl.innerText = dados.displayName || "Usuário";

    const provNameEl = document.getElementById('provider-header-name');
    if(provNameEl) provNameEl.innerText = dados.nome_profissional || dados.displayName || "Prestador";
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
    const tabServicos = document.getElementById('tab-servicos');
    const adminTab = document.getElementById('tab-admin');

    if(isAdmin && adminTab) adminTab.classList.remove('hidden');

    if (userProfile.is_provider) {
        // --- PRESTADOR ---
        if(btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN 🔄` : `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        if(tabServicos) tabServicos.innerText = "Serviços 🛠️";
        
        toggleDisplay('tab-servicos', true);
        toggleDisplay('tab-missoes', true);
        toggleDisplay('tab-oportunidades', true);
        toggleDisplay('tab-ganhar', true);
        
        toggleDisplay('status-toggle-container', true);
        toggleDisplay('servicos-prestador', true);
        toggleDisplay('servicos-cliente', false);
        
        // Ativa Toggle Online/Offline
        const toggle = document.getElementById('online-toggle');
        if(toggle) {
            // Busca estado real no banco active_providers
            getDoc(doc(db, "active_providers", user.uid)).then(snap => {
                if(snap.exists()) toggle.checked = snap.data().is_online;
            });
            
            toggle.onchange = async () => {
                try {
                    await updateDoc(doc(db, "active_providers", user.uid), { is_online: toggle.checked });
                    if(toggle.checked) {
                        const audio = document.getElementById('online-sound');
                        if(audio) audio.play().catch(()=>{});
                    }
                } catch(e) { console.error(e); }
            };
        }

    } else {
        // --- CLIENTE ---
        if(btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN 🔄` : `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;
        if(tabServicos) tabServicos.innerText = "Contratar Serviço 🛠️";
        
        toggleDisplay('tab-servicos', true);
        toggleDisplay('tab-oportunidades', true);
        toggleDisplay('tab-loja', true);
        toggleDisplay('tab-ganhar', true); 

        toggleDisplay('tab-missoes', false);
        toggleDisplay('status-toggle-container', false);
        toggleDisplay('servicos-prestador', false);
        toggleDisplay('servicos-cliente', true);
    }
}

// --- LÓGICA DO PRESTADOR: SERVIÇOS E RADAR ---

// 1. Abrir Modal de Configuração (O QUE ESTAVA FALTANDO)
window.abrirConfiguracaoServicos = async () => {
    const modal = document.getElementById('provider-setup-modal');
    const lista = document.getElementById('my-services-list');
    const select = document.getElementById('new-service-category');
    
    if(!modal) return;
    
    // Popula o Select com as categorias novas
    if(select) {
        select.innerHTML = `<option value="" disabled selected>Escolha uma categoria...</option>`;
        CATEGORIAS_SERVICOS.forEach(cat => {
            select.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }

    modal.classList.remove('hidden');
    lista.innerHTML = `<div class="loader mx-auto border-blue-200 border-t-blue-600"></div>`;

    // Busca serviços atuais
    const docRef = doc(db, "active_providers", auth.currentUser.uid);
    const docSnap = await getDoc(docRef);

    lista.innerHTML = "";
    if (docSnap.exists() && docSnap.data().services) {
        docSnap.data().services.forEach((serv, index) => {
            lista.innerHTML += `
                <div class="bg-gray-50 p-2 rounded flex justify-between items-center border border-gray-200">
                    <div>
                        <span class="font-bold text-xs text-blue-900 block">${serv.category}</span>
                        <span class="text-[10px] text-gray-500">${serv.description || ''}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-green-600 text-xs">R$ ${serv.price}</span>
                        <button onclick="removerServico(${index})" class="text-red-500 font-bold text-lg">&times;</button>
                    </div>
                </div>
            `;
        });
    } else {
        lista.innerHTML = `<p class="text-center text-gray-300 text-xs italic py-4">Nenhum serviço ativo.</p>`;
    }
};

// 2. Adicionar Serviço Localmente
window.addServiceLocal = async () => {
    const cat = document.getElementById('new-service-category').value;
    const price = document.getElementById('new-service-price').value;
    const desc = document.getElementById('new-service-desc').value;

    if (!cat || !price) return alert("Preencha categoria e preço.");

    const novoServico = { category: cat, price: parseFloat(price), description: desc };
    const docRef = doc(db, "active_providers", auth.currentUser.uid);

    try {
        const docSnap = await getDoc(docRef);
        let servicosAtuais = [];
        if (docSnap.exists()) {
            servicosAtuais = docSnap.data().services || [];
        } else {
            // Cria o documento se não existir
            await setDoc(docRef, { 
                uid: auth.currentUser.uid,
                nome_profissional: userProfile.nome_profissional || auth.currentUser.displayName,
                foto_perfil: userProfile.photoURL,
                is_online: true,
                visibility_score: 100,
                created_at: serverTimestamp()
            });
        }

        servicosAtuais.push(novoServico);
        await updateDoc(docRef, { services: servicosAtuais });
        
        alert("Serviço adicionado!");
        document.getElementById('new-service-desc').value = "";
        document.getElementById('new-service-price').value = "";
        
        // Recarrega a lista
        window.abrirConfiguracaoServicos();

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar: " + e.message);
    }
};

// 3. Remover Serviço
window.removerServico = async (index) => {
    if(!confirm("Remover este serviço?")) return;
    const docRef = doc(db, "active_providers", auth.currentUser.uid);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        let servicos = docSnap.data().services;
        servicos.splice(index, 1);
        await updateDoc(docRef, { services: servicos });
        window.abrirConfiguracaoServicos();
    }
};

// 4. Salvar Nome Profissional
window.saveServicesAndGoOnline = async () => {
    const nomeInput = document.getElementById('setup-name').value;
    if(!nomeInput) return alert("Digite seu nome profissional.");

    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
            nome_profissional: nomeInput,
            setup_profissional_ok: true
        });
        
        // Atualiza também na tabela de busca
        const activeRef = doc(db, "active_providers", auth.currentUser.uid);
        const activeSnap = await getDoc(activeRef);
        if(activeSnap.exists()) {
            await updateDoc(activeRef, { nome_profissional: nomeInput, is_online: true });
        } else {
             await setDoc(activeRef, { 
                uid: auth.currentUser.uid,
                nome_profissional: nomeInput,
                foto_perfil: userProfile.photoURL,
                is_online: true,
                visibility_score: 100,
                services: [],
                created_at: serverTimestamp()
            });
        }

        alert("✅ Perfil Atualizado!");
        document.getElementById('provider-setup-modal').classList.add('hidden');
        document.getElementById('online-toggle').checked = true;
        location.reload();
        
    } catch(e) {
        alert("Erro: " + e.message);
    }
};

// 5. RADAR (Ouvinte de Pedidos)
function iniciarRadarPrestador(uid) {
    const radarContainer = document.getElementById('pview-radar');
    if(!radarContainer) return;

    // Busca pedidos pendentes direcionados a este prestador
    const q = query(
        collection(db, "orders"), 
        where("provider_id", "==", uid),
        where("status", "==", "pending")
    );

    onSnapshot(q, (snap) => {
        radarContainer.innerHTML = "";
        if (snap.empty) {
            radarContainer.innerHTML = `
                <div class="animate-pulse flex flex-col items-center justify-center h-40 opacity-50">
                    <div class="text-4xl mb-2">📡</div>
                    <p class="text-xs font-bold uppercase tracking-widest">Buscando Clientes...</p>
                </div>`;
            return;
        }

        // Toca som se houver novos pedidos
        const audio = document.getElementById('notification-sound');
        if(audio && snap.docChanges().some(change => change.type === 'added')) {
            audio.play().catch(()=>{});
        }

        snap.forEach(d => {
            const pedido = d.data();
            radarContainer.innerHTML += `
                <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded shadow-md mb-3 text-left animate-fadeIn">
                    <div class="flex justify-between items-start mb-2">
                        <span class="bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded uppercase">Novo Pedido</span>
                        <span class="text-[9px] text-gray-400 font-bold">${new Date(pedido.created_at?.toDate()).toLocaleTimeString()}</span>
                    </div>
                    <h3 class="font-black text-blue-900 text-sm uppercase mb-1">Oferta: R$ ${pedido.offer_value}</h3>
                    <p class="text-xs text-gray-600 mb-2">Cliente: <strong>${pedido.client_name}</strong></p>
                    <p class="text-[10px] text-gray-500 mb-3">📍 ${pedido.location} | 📅 ${pedido.service_date}</p>
                    
                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="responderPedido('${d.id}', false)" class="bg-white border border-gray-200 text-gray-500 py-2 rounded text-[10px] font-bold uppercase hover:bg-gray-50">Recusar</button>
                        <button onclick="responderPedido('${d.id}', true)" class="bg-green-600 text-white py-2 rounded text-[10px] font-bold uppercase shadow hover:bg-green-700">ACEITAR</button>
                    </div>
                </div>
            `;
        });
    });
}

// 6. Responder Pedido (Função Global)
window.responderPedido = async (orderId, aceitar) => {
    if(!aceitar) {
        if(!confirm("Recusar oferta?")) return;
        await updateDoc(doc(db, "orders", orderId), { status: 'rejected' });
    } else {
        await updateDoc(doc(db, "orders", orderId), { status: 'accepted' });
        
        // Destrava o Chat
        const chatQ = query(collection(db, "chats"), where("order_id", "==", orderId));
        getDoc(doc(db, "chats", orderId)).then(async (snap) => {
             // Atualiza status do chat para 'active'
             if(snap.exists()) await updateDoc(snap.ref, { status: "active" });
        }).catch(async () => {
             // Fallback se o ID do chat for igual ao ID da ordem
             const chatRef = doc(db, "chats", orderId);
             await updateDoc(chatRef, { status: "active" });
        });

        alert("✅ Pedido Aceito! Combine os detalhes no Chat.");
        window.switchTab('chat');
    }
};

// --- UPLOAD FOTO ---
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
        getDoc(activeRef).then(snap => {
            if(snap.exists()) updateDoc(activeRef, { foto_perfil: downloadURL });
        });

        document.querySelectorAll('img[id$="-pic"], #header-user-pic, #provider-header-pic').forEach(img => img.src = downloadURL);
        alert("✅ Foto atualizada!");
    } catch (error) {
        console.error(error);
        alert("Erro no upload. Tente outra imagem.");
    } finally {
        if(overlay) overlay.classList.add('hidden');
        input.value = "";
    }
};

function toggleDisplay(id, show) {
    const el = document.getElementById(id);
    if(el) {
        if(show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
}
