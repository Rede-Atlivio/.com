import { db, auth } from '../app.js';
import { doc, setDoc, collection, query, where, onSnapshot, serverTimestamp, getDoc, updateDoc, orderBy, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. DEFINIÇÕES GLOBAIS ---
const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];
let categoriaAtiva = 'Todos';
let meusServicos = [];
let basePriceAtual = 0;
let targetProviderEmail = null;

// --- 2. EXPOSIÇÃO PARA O NAVEGADOR (CORREÇÃO DOS BOTÕES) ---
// Estas funções PRECISAM estar no window para o onclick do HTML funcionar

window.addServiceLocal = () => {
    const cat = document.getElementById('new-service-category')?.value;
    const price = document.getElementById('new-service-price')?.value;
    const desc = document.getElementById('new-service-desc')?.value || "";

    if (!cat || !price) return alert("Selecione a categoria e o preço!");

    meusServicos.push({
        category: cat,
        price: parseFloat(price),
        description: desc,
        visible: true
    });

    // Limpa campos
    document.getElementById('new-service-category').value = "";
    document.getElementById('new-service-price').value = "";
    document.getElementById('new-service-desc').value = "";

    renderMyServicesList();
};

window.abrirModalSolicitacao = (uid, nomePrestador, precoBase) => {
    if (!auth.currentUser) return alert("Faça login para solicitar!");

    // Configura campos ocultos do modal
    const hiddenId = document.getElementById('target-provider-id');
    const hiddenPrice = document.getElementById('service-base-price');
    if (hiddenId) hiddenId.value = uid;
    if (hiddenPrice) hiddenPrice.value = precoBase;

    targetProviderEmail = nomePrestador;
    basePriceAtual = parseFloat(precoBase);

    // Reseta visual do modal de negociação
    const reqValueInput = document.getElementById('req-value');
    if (reqValueInput) {
        reqValueInput.value = "";
        reqValueInput.disabled = true;
    }
    document.getElementById('radio-custom').checked = false;
    document.getElementById('msg-erro-valor')?.classList.add('hidden');
    document.getElementById('financial-summary')?.classList.add('hidden');
    
    const btnConfirm = document.getElementById('btn-confirm-req');
    if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.classList.add('opacity-50');
    }

    document.getElementById('request-modal')?.classList.remove('hidden');
};

window.abrirConfiguracaoServicos = () => {
    document.getElementById('provider-setup-modal')?.classList.remove('hidden');
    renderMyServicesList();
};

window.switchServiceSubTab = (tab) => {
    ['contratar', 'andamento', 'historico'].forEach(t => {
        document.getElementById(`view-${t}`)?.classList.toggle('hidden', t !== tab);
        document.getElementById(`subtab-${t}-btn`)?.classList.toggle('active', t === tab);
    });
};

window.switchProviderSubTab = (tabName) => {
    ['radar', 'ativos', 'historico'].forEach(t => {
        document.getElementById(`pview-${t}`)?.classList.toggle('hidden', t !== tabName);
        document.getElementById(`ptab-${t}-btn`)?.classList.toggle('active', t === tabName);
    });
};

// --- 3. LÓGICA INTERNA ---

function renderMyServicesList() {
    const list = document.getElementById('my-services-list');
    if (!list) return;

    if (meusServicos.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-300 text-xs italic py-4">Nenhum serviço adicionado.</p>`;
        return;
    }

    list.innerHTML = "";
    meusServicos.forEach((srv, index) => {
        list.innerHTML += `
            <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center mb-2">
                <div class="overflow-hidden">
                    <span class="block font-bold text-xs text-blue-900">${srv.category}</span>
                    <span class="text-[10px] font-bold text-green-600">R$ ${srv.price.toFixed(2)}</span>
                </div>
                <button onclick="removeServiceLocal(${index})" class="text-red-400 font-bold px-2">&times;</button>
            </div>`;
    });
}

window.removeServiceLocal = (index) => {
    meusServicos.splice(index, 1);
    renderMyServicesList();
};

// --- 4. RENDERIZAÇÃO DO CATÁLOGO ---

function carregarPrestadoresOnline() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;

    const q = query(collection(db, "active_providers"), orderBy("is_online", "desc"));
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if (snap.empty) {
            container.innerHTML = `<div class="col-span-2 text-center text-gray-400 py-10">Procurando profissionais...</div>`;
            return;
        }
        snap.forEach(d => {
            const p = d.data();
            if (auth.currentUser && p.uid === auth.currentUser.uid) return;
            const srv = p.services?.[0]; // Pega o primeiro serviço para o card
            if (!srv) return;

            container.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative mb-4">
                <div class="h-16 w-full bg-blue-600 relative">
                    <div class="absolute top-2 right-2 ${p.is_online ? 'bg-green-500' : 'bg-yellow-400'} text-[7px] text-white font-bold px-2 py-0.5 rounded-full">
                        ${p.is_online ? 'ONLINE' : 'AGENDAMENTO'}
                    </div>
                </div>
                <div class="absolute top-8 left-3 w-12 h-12 rounded-full border-4 border-white shadow bg-white overflow-hidden">
                    <img src="${p.foto_perfil || 'https://ui-avatars.com/api/?name=' + p.nome_profissional}" class="w-full h-full object-cover">
                </div>
                <div class="pt-5 pb-3 px-3 text-left">
                    <h4 class="font-black text-xs text-gray-800 truncate">${p.nome_profissional || 'Profissional'}</h4>
                    <p class="text-[9px] font-black text-green-600">R$ ${srv.price}</p>
                    <button onclick="window.abrirModalSolicitacao('${p.uid}', '${p.nome_profissional}', '${srv.price}')" class="w-full mt-2 bg-blue-600 text-white py-1.5 rounded-lg text-[8px] font-bold uppercase shadow-sm">Solicitar</button>
                </div>
            </div>`;
        });
    });
}

// --- 5. INICIALIZAÇÃO ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Carrega identidade
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const d = userDoc.data();
            meusServicos = d.services_offered || [];
            document.querySelectorAll('#header-user-name, #provider-header-name').forEach(el => el.innerText = d.nome_profissional || user.displayName);
            document.querySelectorAll('#header-user-pic, #provider-header-pic').forEach(el => el.src = d.photoURL || user.photoURL);
        }

        // Liga componentes
        if (window.renderizarFiltros) window.renderizarFiltros();
        carregarPrestadoresOnline();
        
        // Ativa Toggle Online
        const toggle = document.getElementById('online-toggle');
        if (toggle) {
            const activeSnap = await getDoc(doc(db, "active_providers", user.uid));
            toggle.checked = activeSnap.exists() && activeSnap.data().is_online;
            toggle.onchange = (e) => window.alternarStatusOnline(e.target.checked);
        }
    }
});

// Tornar funções de status globais
window.alternarStatusOnline = async (isOnline) => {
    if (!auth.currentUser) return;
    const activeRef = doc(db, "active_providers", auth.currentUser.uid);
    try {
        if (isOnline) {
            const userDoc = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
            const d = userDoc.data() || {};
            await setDoc(activeRef, {
                uid: auth.currentUser.uid,
                is_online: true,
                nome_profissional: d.nome_profissional || auth.currentUser.displayName,
                foto_perfil: d.photoURL || auth.currentUser.photoURL,
                services: meusServicos,
                categories: meusServicos.map(s => s.category),
                last_seen: serverTimestamp()
            }, { merge: true });
        } else {
            await updateDoc(activeRef, { is_online: false, last_seen: serverTimestamp() });
        }
        // Dispara visual da antena (pode implementar a div radar aqui)
    } catch (e) { console.error(e); }
};
