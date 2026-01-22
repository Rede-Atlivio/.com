import { db } from './app.js';
import { collection, addDoc, getDocs, getCountFromServer, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- DASHBOARD: CARREGAR MÉTRICAS (PAINEL DE CONTROLE) ---
export async function carregarDashboard() {
    try {
        // 1. Contagem Total de Usuários
        const collUsers = collection(db, "usuarios");
        const snapshotUsers = await getCountFromServer(collUsers);
        const totalUsers = snapshotUsers.data().count;
        
        const elTotal = document.getElementById('dash-total-users');
        if(elTotal) elTotal.innerText = totalUsers;

        // 2. Prestadores Ativos Agora (Online)
        const collActive = collection(db, "active_providers");
        const snapshotActive = await getCountFromServer(collActive);
        const activeProv = snapshotActive.data().count;

        const elActive = document.getElementById('dash-active-providers');
        if(elActive) elActive.innerText = activeProv;

    } catch (e) {
        console.error("Erro ao carregar dashboard:", e);
    }
}

// --- LIMPEZA DE EMERGÊNCIA (RESET) ---
window.limparMissoes = async () => {
    if(!confirm("⚠️ PERIGO: Isso vai apagar TODAS as missões do banco de dados.\n\nUse isso apenas para limpar os serviços que entraram errado na aba errada.")) return;
    
    const btn = event.target;
    btn.innerText = "Apagando...";
    btn.disabled = true;

    try {
        const q = query(collection(db, "missoes"));
        const snap = await getDocs(q);
        
        const promises = snap.docs.map(docSnap => deleteDoc(doc(db, "missoes", docSnap.id)));
        await Promise.all(promises);
        
        alert("✅ Limpeza concluída! A aba Missões deve estar vazia agora.");
        location.reload();
    } catch (e) {
        alert("Erro ao limpar: " + e.message);
        btn.innerText = "Erro (Tente de novo)";
        btn.disabled = false;
    }
};

// --- PAINEL DE VALIDAÇÃO (O CÉREBRO DA OPERAÇÃO) ---
function carregarValidacoes() {
    const container = document.getElementById('admin-pending-list');
    const badge = document.getElementById('count-pending');
    if(!container) return;

    // Busca missões enviadas (submitted)
    const q = query(collection(db, "mission_assignments"), where("status", "==", "submitted"), orderBy("submitted_at", "desc"));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if(snap.empty) {
            container.innerHTML = "<p class='text-center text-xs text-gray-400 py-4'>Nada para validar.</p>";
            if(badge) badge.innerText = "0";
            if(badge) badge.classList.replace('bg-red-500', 'bg-gray-400');
        } else {
            if(badge) badge.innerText = snap.size;
            if(badge) badge.classList.replace('bg-gray-400', 'bg-red-500');

            snap.forEach(d => {
                const item = d.data();
                container.innerHTML += `
                    <div class="border p-3 rounded-lg bg-white shadow-sm flex flex-col gap-2">
                        <div class="flex justify-between items-center border-b pb-2">
                            <span class="font-bold text-xs uppercase text-blue-900">${item.mission_title}</span>
                            <span class="text-[9px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold">AGUARDANDO</span>
                        </div>
                        <div class="flex justify-between items-end">
                            <div class="text-[10px] text-gray-500">
                                <p>Agente: <span class="text-black font-bold">${item.profile_email || 'Anon'}</span></p>
                                <a href="${item.photo_url}" target="_blank" class="text-blue-600 underline mt-1 block">📸 Ver Foto da Prova</a>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="validarMissao('${d.id}', false)" class="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded text-[9px] font-bold hover:bg-red-100">REJEITAR</button>
                                <button onclick="validarMissao('${d.id}', true)" class="bg-green-600 text-white px-3 py-1.5 rounded text-[9px] font-bold shadow-sm hover:bg-green-700">APROVAR</button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
    });
}

// --- SEEDERS (FERRAMENTAS DE TESTE) ---
window.rodarSeedMissao = async () => {
    try {
        await addDoc(collection(db, "missoes"), {
            titulo: "Preço do Tomate",
            descricao: "Vá ao mercado e fotografe o preço.",
            recompensa: "5,00",
            tenant_id: "atlivio_fsa_01",
            status: "aberto",
            created_at: serverTimestamp()
        });
        alert("Missão de teste criada!");
    } catch (e) { alert("Erro: " + e.message); }
};

window.rodarSeedOportunidade = async () => {
    try {
        await addDoc(collection(db, "oportunidades"), {
            titulo: "Bug do iFood",
            descricao: "Cupom de R$ 30 liberado.",
            link: "https://ifood.com.br",
            is_premium: false,
            created_at: serverTimestamp()
        });
        alert("Oportunidade criada!");
    } catch (e) { alert("Erro: " + e.message); }
};

// Inicializa Dashboard se estiver na aba admin
setInterval(() => {
    const secAdmin = document.getElementById('sec-admin');
    if(secAdmin && !secAdmin.classList.contains('hidden')) {
        carregarDashboard();
    }
}, 5000); // Atualiza métricas a cada 5s

// Inicializa Validações
setTimeout(() => {
    const secAdmin = document.getElementById('sec-admin');
    if(secAdmin) carregarValidacoes();
}, 2000);
