import { db, auth } from '../app.js';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, getDoc, updateDoc, increment, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. FUNÇÕES GLOBAIS DE NAVEGAÇÃO ---
window.switchServiceSubTab = (tab) => { 
    ['contratar', 'andamento', 'historico'].forEach(t => { 
        const v = document.getElementById(`view-${t}`); 
        const b = document.getElementById(`subtab-${t}-btn`); 
        if(v) v.classList.add('hidden'); if(b) b.classList.remove('active'); 
    }); 
    const targetV = document.getElementById(`view-${tab}`); 
    const targetB = document.getElementById(`subtab-${tab}-btn`); 
    if(targetV) targetV.classList.remove('hidden'); if(targetB) targetB.classList.add('active'); 
};

window.switchProviderSubTab = (tabName) => { 
    ['radar', 'ativos', 'historico'].forEach(t => { 
        const v = document.getElementById(`pview-${t}`); 
        const b = document.getElementById(`ptab-${t}-btn`); 
        if(v) v.classList.add('hidden'); if(b) b.classList.remove('active'); 
    }); 
    const targetV = document.getElementById(`pview-${tabName}`); 
    const targetB = document.getElementById(`ptab-${tabName}-btn`); 
    if(targetV) targetV.classList.remove('hidden'); if(targetB) targetB.classList.add('active'); 
};

// --- 2. VARIÁVEIS E ESTADO ---
let categoriaAtiva = 'Todos';
let meusServicos = [];
let listenerAtivo = false;
const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];

// --- 3. LÓGICA DO RADAR (O QUE ESTAVA TRAVADO) ---

function atualizarVisualRadar(isOnline) {
    const container = document.getElementById('pview-radar');
    if (!container) return;

    if (isOnline) {
        container.innerHTML = `
            <div id="status-msg" class="text-gray-400 mb-4 py-10 animate-fadeIn">
                <p class="text-6xl mb-4 animate-pulse">📡</p>
                <p class="font-bold text-lg text-green-500">Buscando Clientes...</p>
                <p class="text-xs text-gray-400 mt-2">Seu perfil está visível no catálogo.</p>
            </div>`;
    } else {
        container.innerHTML = `
            <div id="status-msg" class="text-gray-400 mb-4 py-10 animate-fadeIn">
                <p class="text-6xl mb-4">😴</p>
                <p class="font-bold text-lg">Você está Offline</p>
                <p class="text-xs mt-2">Ative o botão "Trabalhar" para receber chamados.</p>
            </div>`;
    }
}

async function ficarOnline() {
    if (!auth.currentUser) return;
    const toggle = document.getElementById('online-toggle');
    
    try {
        const userDoc = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
        const data = userDoc.data() || {};
        
        const updateData = {
            uid: auth.currentUser.uid,
            is_online: true,
            nome_profissional: data.nome_profissional || data.displayName || auth.currentUser.displayName,
            foto_perfil: data.photoURL || auth.currentUser.photoURL,
            services: data.services_offered || [],
            categories: (data.services_offered || []).map(s => s.category),
            last_seen: serverTimestamp()
        };

        await setDoc(doc(db, "active_providers", auth.currentUser.uid), updateData, { merge: true });
        atualizarVisualRadar(true);
        document.getElementById('online-sound')?.play().catch(()=>{});
    } catch (e) {
        console.error("Erro ao ficar online:", e);
        if (toggle) toggle.checked = false;
    }
}

async function ficarOffline() {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, "active_providers", auth.currentUser.uid), { is_online: false, last_seen: serverTimestamp() });
    atualizarVisualRadar(false);
}

// --- 4. MONITOR DE ESTADO ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Inicializa abas e filtros
        if (window.renderizarFiltros) window.renderizarFiltros();
        window.switchServiceSubTab('contratar');
        
        // Verifica se já estava online no banco
        const activeSnap = await getDoc(doc(db, "active_providers", user.uid));
        const toggle = document.getElementById('online-toggle');
        
        if (activeSnap.exists() && activeSnap.data().is_online) {
            if (toggle) toggle.checked = true;
            atualizarVisualRadar(true);
        } else {
            atualizarVisualRadar(false);
        }

        // Configura o evento do botão
        if (toggle) {
            toggle.onchange = (e) => e.target.checked ? ficarOnline() : ficarOffline();
        }

        // Dispara carregamento do catálogo para o cliente
        if (typeof window.carregarPrestadoresOnline === 'function') window.carregarPrestadoresOnline();
    }
});

window.abrirConfiguracaoServicos = () => document.getElementById('provider-setup-modal')?.classList.remove('hidden');
