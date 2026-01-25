import { db } from './app.js';
import { collection, addDoc, getDocs, getCountFromServer, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- DASHBOARD ---
export async function carregarDashboard() {
    try {
        const collUsers = collection(db, "usuarios");
        const snapshotUsers = await getCountFromServer(collUsers);
        const elTotal = document.getElementById('dash-total-users');
        if(elTotal) elTotal.innerText = snapshotUsers.data().count;

        const collActive = collection(db, "active_providers");
        const snapshotActive = await getCountFromServer(collActive);
        const elActive = document.getElementById('dash-active-providers');
        if(elActive) elActive.innerText = snapshotActive.data().count;
    } catch (e) { console.error("Erro dash:", e); }
}

// --- LIMPEZA ---
window.limparMissoes = async () => {
    if(!confirm("⚠️ Apagar TODAS as missões?")) return;
    const btn = event.target;
    btn.innerText = "Apagando...";
    btn.disabled = true;
    try {
        const q = query(collection(db, "missoes"));
        const snap = await getDocs(q);
        const promises = snap.docs.map(docSnap => deleteDoc(doc(db, "missoes", docSnap.id)));
        await Promise.all(promises);
        alert("✅ Limpeza concluída!");
        location.reload();
    } catch (e) {
        alert("Erro: " + e.message);
        btn.innerText = "Erro";
        btn.disabled = false;
    }
};

// --- VALIDAÇÃO ---
function carregarValidacoes() {
    const container = document.getElementById('admin-pending-list');
    const badge = document.getElementById('count-pending');
    if(!container) return;

    const q = query(collection(db, "mission_assignments"), where("status", "==", "submitted"), orderBy("submitted_at", "desc"));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if(snap.empty) {
            container.innerHTML = "<p class='text-center text-xs text-gray-400 py-4'>Nada para validar.</p>";
            if(badge) { badge.innerText = "0"; badge.classList.replace('bg-red-500', 'bg-gray-400'); }
        } else {
            if(badge) { badge.innerText = snap.size; badge.classList.replace('bg-gray-400', 'bg-red-500'); }
            snap.forEach(d => {
                const item = d.data();
                const valorFormatado = item.valor_bruto ? item.valor_bruto.toFixed(2) : "0.00";
                
                container.innerHTML += `
                    <div class="border p-3 rounded-lg bg-white shadow-sm flex flex-col gap-2">
                        <div class="flex justify-between items-center border-b pb-2">
                            <span class="font-bold text-xs uppercase text-blue-900">${item.mission_title}</span>
                            <span class="text-[9px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold">R$ ${valorFormatado}</span>
                        </div>
                        <div class="flex justify-between items-end">
                            <div class="text-[10px] text-gray-500">
                                <p>Agente: <span class="text-black font-bold">${item.profile_email || 'Anon'}</span></p>
                                <a href="${item.photo_url}" target="_blank" class="text-blue-600 underline mt-1 block">📸 Ver Foto</a>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="validarMissao('${d.id}', false, '${item.profile_id}', 0)" class="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded text-[9px] font-bold">REJEITAR</button>
                                <button onclick="validarMissao('${d.id}', true, '${item.profile_id}', ${item.valor_bruto})" class="bg-green-600 text-white px-3 py-1.5 rounded text-[9px] font-bold shadow-sm">APROVAR</button>
                            </div>
                        </div>
                    </div>`;
            });
        }
    });
}

// --- FUNÇÃO DE APROVAÇÃO/REJEIÇÃO (FALTAVA ANTES) ---
window.validarMissao = async (docId, aprovado, userId, valor) => {
    const btn = event.target;
    const textoOriginal = btn.innerText;
    btn.disabled = true;
    btn.innerText = "⏳";

    try {
        const assignmentRef = doc(db, "mission_assignments", docId);
        
        if (aprovado) {
            if(!confirm(`Aprovar e enviar R$ ${valor} para o usuário?`)) {
                 btn.disabled = false; btn.innerText = textoOriginal; return; 
            }

            // 1. Atualiza Status da Missão
            await updateDoc(assignmentRef, {
                status: "approved",
                approved_at: serverTimestamp()
            });

            // 2. Adiciona Saldo ao Usuário
            const userRef = doc(db, "usuarios", userId);
            await updateDoc(userRef, {
                saldo: increment(valor)
            });

            alert("✅ Aprovado! Saldo creditado.");
        } else {
            const motivo = prompt("Motivo da rejeição:");
            if(motivo === null) { btn.disabled = false; btn.innerText = textoOriginal; return; }

            await updateDoc(assignmentRef, {
                status: "rejected",
                rejection_reason: motivo,
                rejected_at: serverTimestamp()
            });
            alert("❌ Rejeitado.");
        }
    } catch (e) {
        alert("Erro: " + e.message);
        btn.disabled = false;
        btn.innerText = textoOriginal;
    }
};

// --- SEEDERS (FERRAMENTAS DE TESTE) ---
window.rodarSeedMissao = async () => {
    try {
        await addDoc(collection(db, "missoes"), {
            titulo: "Preço do Tomate", descricao: "Vá ao mercado e fotografe.", recompensa: "5,00",
            tenant_id: "atlivio_fsa_01", status: "aberto", created_at: serverTimestamp()
        });
        alert("✅ Missão criada!");
    } catch (e) { alert("Erro: " + e.message); }
};

window.rodarSeedOportunidade = async () => {
    try {
        await addDoc(collection(db, "oportunidades"), {
            titulo: "Bug do iFood", descricao: "Cupom R$ 30", link: "https://ifood.com.br",
            is_premium: false, created_at: serverTimestamp()
        });
        alert("✅ Oportunidade criada!");
    } catch (e) { alert("Erro: " + e.message); }
};

window.rodarSeedProdutos = async () => {
    try {
        const produtosExemplo = [
            { nome: "iPhone 15 Pro Max", preco: 8500.00, categoria: "Eletrônicos", img: "https://http2.mlstatic.com/D_NQ_NP_2X_759904-MLA71783266948_092023-F.webp", desc: "Original Lacrado", destaque: true },
            { nome: "Curso Marketing Digital", preco: 97.00, categoria: "Infoproduto", img: "https://img.freepik.com/fotos-gratis/marketing-digital-com-icones-de-negocios-e-tecnologia_53876-47820.jpg", desc: "Venda Todo Dia", destaque: false },
            { nome: "Fone Bluetooth Pro", preco: 129.90, categoria: "Acessórios", img: "https://m.media-amazon.com/images/I/51+u0M-8tJL._AC_UF894,1000_QL80_.jpg", desc: "Grave Potente", destaque: false }
        ];

        for (const p of produtosExemplo) {
            await addDoc(collection(db, "produtos"), {
                ...p, created_at: serverTimestamp()
            });
        }
        alert("✅ 3 Produtos adicionados à loja!");
    } catch (e) { alert("Erro: " + e.message); }
};

// Inicialização
setInterval(() => {
    const secAdmin = document.getElementById('sec-admin');
    if(secAdmin && !secAdmin.classList.contains('hidden')) carregarDashboard();
}, 5000);

setTimeout(() => {
    // Verifica periodicamente se a seção admin apareceu para iniciar o listener de validações
    const secAdmin = document.getElementById('sec-admin');
    if(secAdmin) carregarValidacoes();
}, 2000);
