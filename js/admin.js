import { db } from './app.js';
import { collection, query, where, getDocs, updateDoc, doc, increment, serverTimestamp, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. DASHBOARD (VISÃO GERAL) ---
export async function carregarAdmin() {
    const container = document.getElementById('admin-dashboard');
    if(!container) return;

    // Métricas em Tempo Real (Simples e Cruas)
    // Nota: Em escala, isso seria feito no Backend para não ler o banco todo.
    const usersSnap = await getDocs(collection(db, "usuarios"));
    const missionsSnap = await getDocs(collection(db, "mission_assignments"));
    
    let totalUsers = usersSnap.size;
    let totalProviders = 0;
    let totalSaldo = 0;

    usersSnap.forEach(u => {
        const data = u.data();
        if(data.is_provider) totalProviders++;
        totalSaldo += (data.saldo || 0);
    });

    let pendingMissions = 0;
    missionsSnap.forEach(m => {
        if(m.data().status === 'submitted') pendingMissions++;
    });

    // Renderiza o Painel de Números
    document.getElementById('metric-users').innerText = totalUsers;
    document.getElementById('metric-providers').innerText = totalProviders;
    document.getElementById('metric-money').innerText = `R$ ${totalSaldo.toFixed(2)}`;
    document.getElementById('metric-pending').innerText = pendingMissions;

    carregarPendencias();
}

// --- 2. GESTÃO DE MISSÕES (ATLAS) ---
function carregarPendencias() {
    const container = document.getElementById('admin-pending-list');
    const q = query(collection(db, "mission_assignments"), where("status", "==", "submitted"));
    
    // (Lógica de carregar lista - igual à anterior, mas encapsulada)
    // ... mantendo a lógica visual simples por enquanto
}

// --- 3. GOD MODE (GESTÃO DE CARTEIRA) ---
window.adminAjustarSaldo = async () => {
    const email = prompt("Email do usuário para ajustar:");
    if(!email) return;

    // Busca usuário pelo email (Ineficiente, mas funcional pro MVP)
    const q = query(collection(db, "usuarios"), where("email", "==", email));
    const snap = await getDocs(q);

    if(snap.empty) {
        alert("Usuário não encontrado.");
        return;
    }

    const userDoc = snap.docs[0];
    const novoValor = prompt(`Saldo atual: R$ ${userDoc.data().saldo || 0}\nDigite o valor a ADICIONAR (use - para remover):`);
    
    if(novoValor) {
        await updateDoc(doc(db, "usuarios", userDoc.id), {
            saldo: increment(parseFloat(novoValor))
        });
        alert("Saldo atualizado.");
        carregarAdmin(); // Recarrega números
    }
};

// --- 4. MODOS DE OPERAÇÃO (ON/OFF GERAL) ---
window.adminToggleSistema = async (modo) => {
    // Salva uma flag no banco que o app.js lerá para bloquear acesso
    const configRef = doc(db, "config", "geral");
    await setDoc(configRef, { modo_operacao: modo }, { merge: true });
    alert(`Sistema alterado para modo: ${modo}`);
    
    // Atualiza visual dos botões
    document.getElementById('btn-mode-public').className = modo === 'public' ? "bg-green-600 text-white p-2 rounded text-[10px]" : "bg-gray-200 p-2 rounded text-[10px]";
    document.getElementById('btn-mode-manutencao').className = modo === 'manutencao' ? "bg-red-600 text-white p-2 rounded text-[10px]" : "bg-gray-200 p-2 rounded text-[10px]";
};

// Funções de Aprovação (Mantidas)
window.aprovarProva = async (docId, userId, valorBruto) => { 
    if(!confirm(`Aprovar e pagar?`)) return; 
    try { 
        await updateDoc(doc(db, "mission_assignments", docId), { status: "approved", approved_at: serverTimestamp() }); 
        await updateDoc(doc(db, "usuarios", userId), { saldo: increment(valorBruto) });
        carregarAdmin();
    } catch (e) { alert(e.message); } 
};

window.rejeitarProva = async (docId) => { 
    if(!confirm("Rejeitar?")) return; 
    await updateDoc(doc(db, "mission_assignments", docId), { status: "rejected" });
    carregarAdmin();
};

// Auto-Load quando abre a aba admin
setInterval(() => {
    const sec = document.getElementById('sec-admin');
    if(sec && !sec.classList.contains('hidden')) carregarAdmin();
}, 10000);
