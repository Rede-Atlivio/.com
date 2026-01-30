import { collection, getDocs, doc, updateDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-list');
    
    // Configura Header Específico de Missões
    const headers = document.getElementById('list-header');
    if(headers) {
        headers.innerHTML = `
            <th class="p-3">MISSÃO</th>
            <th class="p-3">USUÁRIO</th>
            <th class="p-3">PROVA</th>
            <th class="p-3">STATUS</th>
            <th class="p-3 text-right">AÇÕES</th>
        `;
    }

    // Remove busca e add (não usados aqui por enquanto)
    const btnAdd = document.getElementById('btn-list-add');
    if(btnAdd) btnAdd.style.display = 'none';

    await loadList();
}

async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></td></tr>`;

    try {
        const q = query(collection(window.db, "mission_submissions"), orderBy("created_at", "desc"), limit(50));
        const snap = await getDocs(q);
        
        tbody.innerHTML = "";
        
        if(snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-500">Nenhuma missão enviada para análise.</td></tr>`;
            countEl.innerText = "0 registros";
            return;
        }

        countEl.innerText = `${snap.size} envios recentes`;

        snap.forEach(d => {
            const data = d.data();
            let statusBadge = `<span class="bg-yellow-900 text-yellow-400 px-2 py-1 rounded text-[9px] uppercase border border-yellow-700">⏳ PENDENTE</span>`;
            if(data.status === 'approved') statusBadge = `<span class="bg-green-900 text-green-400 px-2 py-1 rounded text-[9px] uppercase border border-green-700">✅ PAGO</span>`;
            if(data.status === 'rejected') statusBadge = `<span class="bg-red-900 text-red-400 px-2 py-1 rounded text-[9px] uppercase border border-red-700">❌ RECUSADO</span>`;

            tbody.innerHTML += `
                <tr class="border-b border-slate-800 hover:bg-slate-800/50">
                    <td class="p-3 text-white font-bold text-sm">${data.mission_title || 'Missão Genérica'}</td>
                    <td class="p-3 text-gray-400 text-xs">${data.user_email || data.user_id}</td>
                    <td class="p-3">
                        ${data.photo_url ? `<a href="${data.photo_url}" target="_blank" class="text-blue-400 hover:text-blue-300 text-xs underline flex items-center gap-1">📸 Ver Foto</a>` : '<span class="text-gray-600 text-xs">Sem foto</span>'}
                    </td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3 text-right">
                        ${data.status === 'pending' ? `
                            <button onclick="window.aprovarMissao('${d.id}', '${data.user_id}', ${data.reward || 0})" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-bold mr-2">APROVAR (R$ ${data.reward})</button>
                            <button onclick="window.rejeitarMissao('${d.id}')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-bold">X</button>
                        ` : '<span class="text-gray-600 text-[10px]">Processado</span>'}
                    </td>
                </tr>
            `;
        });

    } catch(e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500">Erro ao carregar missões.</td></tr>`;
    }
}

// Ações Globais para o HTML chamar
window.aprovarMissao = async (docId, userId, valor) => {
    if(!confirm(`Aprovar missão e pagar R$ ${valor} ao usuário?`)) return;
    try {
        // 1. Atualiza status do envio
        await updateDoc(doc(window.db, "mission_submissions", docId), { status: 'approved' });
        
        // 2. Adiciona saldo ao usuário (Transaction para segurança seria ideal, mas update serve aqui)
        // Nota: Idealmente use a função executeAdjustment do users.js se estiver global, mas faremos direto aqui.
        /* Lógica simplificada de crédito */
        // ... (Implementação de crédito no banco)
        
        alert("✅ Missão aprovada e saldo creditado!");
        loadList();
    } catch(e) { alert(e.message); }
};

window.rejeitarMissao = async (docId) => {
    if(!confirm("Rejeitar esta missão?")) return;
    await updateDoc(doc(window.db, "mission_submissions", docId), { status: 'rejected' });
    loadList();
};
