import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const storage = getStorage();
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";
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
                    atualizarInterfaceUsuario(userProfile);
                    iniciarAppLogado(user);
                    
                    if (userProfile.is_provider) {
                        iniciarRadarPrestador(user.uid);
                        // --- CORREÇÃO: Chama a função do botão aqui ---
                        ativarBotaoOnline(user.uid); 
                        
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
        if(btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN 🔄` : `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        if(tabServicos) tabServicos.innerText = "Serviços 🛠️";
        
        toggleDisplay('tab-servicos', true);
        toggleDisplay('tab-missoes', true);
        toggleDisplay('tab-oportunidades', true);
        toggleDisplay('tab-ganhar', true);
        
        toggleDisplay('status-toggle-container', true);
        toggleDisplay('servicos-prestador', true);
        toggleDisplay('servicos-cliente', false);
    } else {
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

// --- NOVA FUNÇÃO BLINDADA PARA O BOTÃO ONLINE ---
function ativarBotaoOnline(uid) {
    const toggle = document.getElementById('online-toggle');
    if (!toggle) return;

    // 1. Carregar estado inicial
    getDoc(doc(db, "active_providers", uid)).then(snap => {
        if(snap.exists()) {
            toggle.checked = snap.data().is_online;
            console.log("Estado inicial carregado:", toggle.checked);
        }
    });

    // 2. Remover listeners antigos para evitar duplicação (cloneNode truque)
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);

    // 3. Adicionar listener novo e limpo
    newToggle.addEventListener('change', async (e) => {
        console.log("🔘 CLIQUE NO TOGGLE DETECTADO! Novo estado:", newToggle.checked);
        
        try {
            await updateDoc(doc(db, "active_providers", uid), { is_online: newToggle.checked });
            
            if(newToggle.checked) {
                const audio = document.getElementById('online-sound');
                if(audio) audio.play().catch(()=>{});
            }
        } catch(err) {
            console.error("Erro ao mudar status:", err);
            // Reverte visualmente se der erro
            newToggle.checked = !newToggle.checked;
            alert("Erro de conexão ao mudar status.");
        }
    });
}

// --- LÓGICA DO PRESTADOR: SERVIÇOS E RADAR ---

window.abrirConfiguracaoServicos = async () => {
    const modal = document.getElementById('provider-setup-modal');
    const lista = document.getElementById('my-services-list');
    const select = document.getElementById('new-service-category');
    
    if(!modal) return;
    
    if(select) {
        select.innerHTML = `<option value="" disabled selected>Escolha uma categoria...</option>`;
        CATEGORIAS_SERVICOS.forEach(cat => {
            select.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }

    modal.classList.remove('hidden');
    lista.innerHTML = `<div class="loader mx-auto border-blue-200 border-t-blue-600"></div>`;

    const docRef = doc(db, "active_providers", auth.currentUser.uid);
    const docSnap = await getDoc(docRef);

    lista.innerHTML = "";
    if (docSnap.exists() && docSnap.data().services) {
        docSnap.data().services.forEach((serv, index) => {
            lista.innerHTML += `
                <div class="bg-gray-50 p-3 rounded flex justify-between items-center border border-gray-200 shadow-sm mb-2">
                    <div>
                        <span class="font-bold text-xs text-blue-900 block">${serv.category}</span>
                        <span class="text-[10px] text-gray-500 italic">${serv.description || 'Sem descrição'}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="font-black text-green-600 text-xs">R$ ${serv.price}</span>
                        <button onclick="editarServico(${index})" class="text-blue-500 text-xs font-bold border border-blue-200 p-1 rounded hover:bg-blue-50">✏️</button>
                        <button onclick="removerServico(${index})" class="text-red-500 font-bold text-lg hover:scale-110 transition">&times;</button>
                    </div>
                </div>
            `;
        });
    } else {
        lista.innerHTML = `<p class="text-center text-gray-300 text-xs italic py-4">Nenhum serviço ativo.</p>`;
    }
};

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
        
        document.getElementById('new-service-desc').value = "";
        document.getElementById('new-service-price').value = "";
        
        window.abrirConfiguracaoServicos();

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar: " + e.message);
    }
};

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

window.editarServico = async (index) => {
    const docRef = doc(db, "active_providers", auth.currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if(docSnap.exists()) {
        const servicos = docSnap.data().services;
        const item = servicos[index];

        document.getElementById('new-service-category').value = item.category;
        document.getElementById('new-service-price').value = item.price;
        document.getElementById('new-service-desc').value = item.description;

        servicos.splice(index, 1);
        await updateDoc(docRef, { services: servicos });
        window.abrirConfiguracaoServicos();
        document.getElementById('new-service-price').focus();
    }
};

window.saveServicesAndGoOnline = async () => {
    const nomeInput = document.getElementById('setup-name').value;
    if(!nomeInput) return alert("Digite seu nome profissional.");

    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
            nome_profissional: nomeInput,
            setup_profissional_ok: true
        });
        
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

// 5. RADAR "UBER"
function iniciarRadarPrestador(uid) {
    const radarContainer = document.getElementById('pview-radar');
    if(!radarContainer) return;

    const q = query(
        collection(db, "orders"), 
        where("provider_id", "==", uid),
        where("status", "==", "pending")
    );

    onSnapshot(q, (snap) => {
        radarContainer.innerHTML = "";
        
        if (snap.empty) {
            radarContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10">
                    <div class="relative flex h-32 w-32 items-center justify-center mb-4">
                        <div class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></div>
                        <div class="animate-ping absolute inline-flex h-24 w-24 rounded-full bg-blue-500 opacity-40 animation-delay-500"></div>
                        <span class="relative inline-flex rounded-full h-16 w-16 bg-white border-4 border-blue-600 items-center justify-center text-3xl shadow-xl z-10">
                            📡
                        </span>
                    </div>
                    <p class="text-xs font-black uppercase tracking-widest text-blue-900 animate-pulse">Procurando Clientes...</p>
                    <p class="text-[9px] text-gray-400 mt-2">Mantenha esta tela aberta.</p>
                </div>`;
            return;
        }

        const audio = document.getElementById('notification-sound');
        if(audio && snap.docChanges().some(change => change.type === 'added')) {
            audio.play().catch(()=>{});
            if(navigator.vibrate) navigator.vibrate([500, 200, 500]);
        }

        snap.forEach(d => {
            const pedido = d.data();
            radarContainer.innerHTML += `
                <div class="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl mb-4 border-2 border-blue-500 animate-fadeIn relative overflow-hidden">
                    <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-600 rounded-full blur-2xl opacity-50"></div>
                    <div class="relative z-10 text-center">
                        <div class="bg-blue-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase inline-block mb-3 animate-pulse">
                            Nova Solicitação
                        </div>
                        <h2 class="text-4xl font-black text-white mb-1">R$ ${pedido.offer_value}</h2>
                        <p class="text-xs text-gray-300 uppercase tracking-wide mb-6">Oferta do Cliente</p>
                        <div class="bg-slate-800 p-3 rounded-xl mb-6 text-left border border-slate-700">
                            <div class="flex items-center gap-3 mb-2">
                                <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-lg">👤</div>
                                <div>
                                    <p class="font-bold text-sm text-white">${pedido.client_name}</p>
                                    <p class="text-[10px] text-gray-400">Cliente 5.0 ★</p>
                                </div>
                            </div>
                            <div class="border-t border-slate-700 my-2"></div>
                            <p class="text-xs text-gray-300">📍 <strong>Local:</strong> ${pedido.location}</p>
                            <p class="text-xs text-gray-300 mt-1">📅 <strong>Data:</strong> ${pedido.service_date} às ${pedido.service_time}</p>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <button onclick="responderPedido('${d.id}', false)" class="bg-slate-700 text-gray-300 py-4 rounded-xl font-black uppercase text-xs hover:bg-slate-600">✖ Recusar</button>
                            <button onclick="responderPedido('${d.id}', true)" class="bg-green-500 text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg shadow-green-500/30 hover:bg-green-600 transform active:scale-95 transition">✔ ACEITAR CORRIDA</button>
                        </div>
                    </div>
                </div>
            `;
        });
    });
}

window.responderPedido = async (orderId, aceitar) => {
    if(!aceitar) {
        await updateDoc(doc(db, "orders", orderId), { status: 'rejected' });
    } else {
        await updateDoc(doc(db, "orders", orderId), { status: 'accepted' });
        
        const chatQ = query(collection(db, "chats"), where("order_id", "==", orderId));
        getDoc(doc(db, "chats", orderId)).then(async (snap) => {
             if(snap.exists()) await updateDoc(snap.ref, { status: "active" });
        }).catch(async () => {
             const chatRef = doc(db, "chats", orderId);
             await updateDoc(chatRef, { status: "active" });
        });

        alert("✅ Pedido Aceito! Combine os detalhes no Chat.");
        window.switchTab('chat');
    }
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
