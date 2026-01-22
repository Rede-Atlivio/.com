import { db } from './app.js';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SEEDERS (Dados de Teste) ---
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

// --- LIMPEZA DE EMERGÊNCIA (RESET) ---
window.limparMissoes = async () => {
    if(!confirm("⚠️ PERIGO: Isso vai apagar TODAS as missões do banco de dados.\n\nUse isso apenas para limpar os serviços que entraram errado na aba errada.")) return;
    
    const btn = event.target;
    btn.innerText = "Apagando...";
    btn.disabled = true;

    try {
        const q = query(collection(db, "missoes"));
        const snap = await getDocs(q);
        
        // Apaga um por um (Firestore não tem 'delete all' nativo simples no client)
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

// --- PAINEL DE VALIDAÇÃO ---
function carregarValidacoes() {
    const container = document.getElementById('admin-pending-list');
    if(!container) return;

    // Busca missões enviadas (submitted)
    const q = query(collection(db, "mission_assignments"), where("status", "==", "submitted"), orderBy("submitted_at", "desc"));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if(snap.empty) {
            container.innerHTML = "<p class='text-xs text-gray-400'>Nada para validar.</p>";
        } else {
            snap.forEach(d => {
                const item = d.data();
                container.innerHTML += `
                    <div class="border p-3 rounded-lg bg-gray-50 flex flex-col gap-2">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-xs uppercase">${item.mission_title}</span>
                            <span class="text-[10px] bg-yellow-200 px-2 py-1 rounded">Pendente</span>
                        </div>
                        <p class="text-[10px] text-gray-500">User: ${item.profile_email}</p>
                        <a href="${item.photo_url}" target="_blank" class="text-blue-600 text-[10px] underline">Ver Foto</a>
                        
                        <div class="flex gap-2 mt-2">
                            <button onclick="validarMissao('${d.id}', true)" class="flex-1 bg-green-500 text-white py-2 rounded text-[10px] font-bold">APROVAR</button>
                            <button onclick="validarMissao('${d.id}', false)" class="flex-1 bg-red-500 text-white py-2 rounded text-[10px] font-bold">REJEITAR</button>
                        </div>
                    </div>
                `;
            });
        }
    });
}

// Inicializa o listener se estiver na aba admin
setTimeout(() => {
    const secAdmin = document.getElementById('sec-admin');
    if(secAdmin) carregarValidacoes();
}, 2000);
