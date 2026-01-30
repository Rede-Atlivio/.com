import { collection, getDocs, doc, updateDoc, query, orderBy, limit, writeBatch, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-list');
    
    // Configura o Cabeçalho da Tabela
    document.getElementById('list-header').innerHTML = `
        <th class="p-3">MISSÃO</th>
        <th class="p-3">USUÁRIO</th>
        <th class="p-3">PROVA</th>
        <th class="p-3">STATUS</th>
        <th class="p-3 text-right">AÇÕES</th>
    `;
    
    // Esconde botão "Novo" pois admin não cria missão por aqui, só aprova
    const btnAdd = document.getElementById('btn-list-add');
    if(btnAdd) btnAdd.style.display = 'none';
    
    // Exporta Globais para o HTML conseguir clicar
    window.aprovarMissao = aprovarMissao;
    window.rejeitarMissao = rejeitarMissao;

    await loadList();
}

async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader mx-auto border-blue-500"></div></td></tr>`;

    try {
        // Busca envios de missões (ajuste o nome da coleção se for diferente no seu banco)
        const q = query(collection(window.db, "mission_submissions"), orderBy("created_at", "desc"), limit(50));
        const snap = await getDocs(q);
        
        tbody.innerHTML = "";
        
        if(snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-500">Nenhuma missão enviada para análise.</td></tr>`;
            if(countEl) countEl.innerText = "0 registros";
            return;
        }

        if(countEl) countEl.innerText = `${snap.size} registros`;

        snap.forEach(d => {
            const data = d.data();
            
            // Badges de Status
            let statusBadge = `<span class="bg-yellow-900 text-yellow-400 px-2 py-1 rounded text-[9px] uppercase border border-yellow-700">⏳ PENDENTE</span>`;
            if(data.status === 'approved') statusBadge = `<span class="bg-green-900 text-green-400 px-2 py-1 rounded text-[9px] uppercase border border-green-700">✅ PAGO</span>`;
            if(data.status === 'rejected') statusBadge = `<span class="bg-red-900 text-red-400 px-2 py-1 rounded text-[9px] uppercase border border-red-700">❌ RECUSADO</span>`;

            // Link da Foto
            const photoLink = data.photo_url 
                ? `<a href="${data.photo_url}" target="_blank" class="text-blue-400 hover:text-blue-300 text-xs underline flex items-center gap-1">📸 Ver Foto</a>` 
                : '<span class="text-gray-600 text-xs">Sem foto</span>';

            tbody.innerHTML += `
                <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition">
                    <td class="p-3 text-white font-bold text-sm">${data.mission_title || 'Missão'}</td>
                    <td class="p-3 text-gray-400 text-xs">${data.user_email || data.user_id}</td>
                    <td class="p-3">${photoLink}</td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3 text-right">
                        ${data.status === 'pending' ? `
                            <button onclick="window.aprovarMissao('${d.id}', '${data.user_id}', ${data.reward || 10})" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-bold mr-2 transition">APROVAR (R$ ${data.reward||10})</button>
                            <button onclick="window.rejeitarMissao('${d.id}')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-bold transition">X</button>
                        ` : '<span class="text-gray-600 text-[10px]">Processado</span>'}
                    </td>
                </tr>
            `;
        });
    } catch(e) { 
        console.error(e); 
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500">Erro ao carregar: ${e.message}</td></tr>`;
    }
}

async function aprovarMissao(docId, userId, valor) {
    if(!confirm(`Aprovar e pagar R$ ${valor}?`)) return;
    
    try {
        // 1. Atualiza status da missão
        await updateDoc(doc(window.db, "mission_submissions", docId), { status: 'approved' });
        
        // 2. Paga o usuário (Transação Segura)
        const userRef = doc(window.db, "usuarios", userId);
        await runTransaction(window.db, async (t) => {
            const uDoc = await t.get(userRef);
            if(uDoc.exists()) {
                const novo = (uDoc.data().saldo || 0) + parseFloat(valor);
                // Atualiza tanto saldo quanto wallet_balance para garantir
                t.update(userRef, { saldo: novo, wallet_balance: novo });
            }
        });

        // 3. Notifica
        await addDoc(collection(window.db, "notifications"), {
            uid: userId,
            message: `💰 Parabéns! Você recebeu R$ ${valor} pela missão concluída.`,
            read: false,
            type: 'success',
            created_at: serverTimestamp()
        });

        alert("✅ Pago com sucesso!");
        loadList();
        
    } catch(e) { 
        alert("Erro: " + e.message); 
    }
}

async function rejeitarMissao(docId) {
    if(!confirm("Rejeitar esta missão?")) return;
    await updateDoc(doc(window.db, "mission_submissions", docId), { status: 'rejected' });
    loadList();
}
