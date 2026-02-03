import { db, auth } from '../config.js';
import { doc, updateDoc, addDoc, collection, serverTimestamp, runTransaction, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================================
// LÓGICA DE AVALIAÇÃO (BILATERAL)
// ============================================================================
export async function enviarAvaliacao(orderId, targetId, stars, complimentsArray, comment) {
    if(!auth.currentUser) return;

    try {
        const userRef = doc(db, "usuarios", targetId);
        const providerRef = doc(db, "active_providers", targetId);

        await runTransaction(db, async (transaction) => {
            // 1. LEITURA
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "Usuário alvo não encontrado!";
            
            const providerDoc = await transaction.get(providerRef);
            const isTargetProvider = providerDoc.exists();

            // 2. CÁLCULOS
            const data = userDoc.data();
            let currentCount = data.rating_count || 0;
            let currentAvg = data.rating_avg || 5.0;
            
            let newCount = currentCount + 1;
            let newAvg = ((currentAvg * currentCount) + parseInt(stars)) / newCount;
            newAvg = Math.round(newAvg * 100) / 100;

            // 3. ESCRITA
            transaction.update(userRef, { rating_avg: newAvg, rating_count: newCount });

            if(isTargetProvider) {
                transaction.update(providerRef, { rating_avg: newAvg, rating_count: newCount });
            }
        });

        // 4. SALVAR NO HISTÓRICO
        await addDoc(collection(db, "reviews"), {
            order_id: orderId,
            from_user: auth.currentUser.uid,
            to_user: targetId,
            stars: parseInt(stars),
            compliments: complimentsArray,
            comment: comment,
            created_at: serverTimestamp()
        });

        return true;
    } catch (e) {
        console.error("Erro avaliação:", e);
        alert("Erro ao avaliar: " + e.message);
        return false;
    }
}

// ============================================================================
// MODAL DE AVALIAÇÃO
// ============================================================================
export function abrirModalAvaliacao(orderId, targetId, targetName) {
    const antigo = document.getElementById('modal-review');
    if(antigo) antigo.remove();

    const div = document.createElement('div');
    div.id = 'modal-review';
    div.className = "fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn";
    div.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
            <div class="p-6 text-center">
                <button onclick="document.getElementById('modal-review').remove()" class="absolute top-4 right-4 text-gray-400 font-bold text-xl">&times;</button>
                <h3 class="text-lg font-black text-gray-800 mb-1">Avaliar ${targetName}</h3>
                <p class="text-xs text-gray-500 mb-6">Como foi a experiência?</p>
                
                <div class="flex justify-center gap-2 mb-6" id="star-container">
                    ${[1,2,3,4,5].map(i => `<button onclick="window.setStar(${i})" class="star-btn text-4xl text-gray-200 hover:scale-110 transition" data-val="${i}">★</button>`).join('')}
                </div>
                <input type="hidden" id="selected-star" value="0">

                <div class="flex flex-wrap gap-2 justify-center mb-4">
                    ${['Pontual ⏰', 'Educado 🤝', 'Profissional 💼', 'Rápido ⚡', 'Pagou Rápido 💸'].map(tag => 
                        `<button onclick="this.classList.toggle('bg-blue-100'); this.classList.toggle('text-blue-600');" class="tag-btn border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-500 transition">${tag}</button>`
                    ).join('')}
                </div>

                <textarea id="review-comment" class="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm mb-4 outline-none focus:border-blue-500" placeholder="Deixe um comentário..." rows="2"></textarea>
                
                <button onclick="window.confirmarAvaliacao('${orderId}', '${targetId}')" class="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-800 transition">ENVIAR AVALIAÇÃO</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

window.setStar = (val) => {
    document.getElementById('selected-star').value = val;
    document.querySelectorAll('.star-btn').forEach(b => {
        b.style.color = parseInt(b.dataset.val) <= val ? "#FFD700" : "#E5E7EB";
    });
};

window.confirmarAvaliacao = async (oid, tid) => {
    const stars = document.getElementById('selected-star').value;
    if(stars == 0) return alert("Selecione as estrelas!");
    const tags = Array.from(document.querySelectorAll('.tag-btn.bg-blue-100')).map(b => b.innerText);
    const comment = document.getElementById('review-comment').value;

    const btn = document.querySelector('#modal-review button:last-child');
    btn.disabled = true;
    btn.innerText = "ENVIANDO...";

    const success = await enviarAvaliacao(oid, tid, stars, tags, comment);
    if(success) {
        document.getElementById('modal-review').remove();
        alert("✅ Avaliação enviada! Obrigado.");
    } else {
        btn.disabled = false;
        btn.innerText = "TENTAR NOVAMENTE";
    }
};

// EXPORTAÇÕES GLOBAIS
window.abrirModalAvaliacao = abrirModalAvaliacao;
window.enviarAvaliacao = enviarAvaliacao;
// ============================================================================
// 🚨 REGRA DE PENALTY ATLIVIO (ANTI-GOLPE)
// ============================================================================
window.cancelarComPenalty = async (orderId) => {
    const orderRef = doc(db, "orders", orderId);
    const snap = await getDoc(orderRef);
    const pedido = snap.data();

    // Se o contato já foi liberado (Step 3)
    if (pedido.system_step >= 3) {
        const confirmar = confirm("⚠️ ATENÇÃO: O contato já foi liberado. Ao cancelar agora, os R$ 20,00 da reserva NÃO serão estornados. Eles serão retidos como taxa de segurança. Deseja prosseguir?");
        if(!confirmar) return;

        await updateDoc(orderRef, { 
            status: 'cancelled_penalty', 
            penalty_applied: true,
            cancelled_at: serverTimestamp() 
        });
        alert("Cancelamento efetuado. Reserva retida por violação de fluxo.");
    } else {
        if(confirm("Deseja cancelar esta solicitação?")) {
            await updateDoc(orderRef, { status: 'cancelled', cancelled_at: serverTimestamp() });
        }
    }
    window.voltarParaListaPedidos();
};
