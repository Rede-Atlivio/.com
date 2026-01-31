import { db, auth } from '../app.js';
import { doc, updateDoc, addDoc, collection, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 10. LÓGICA DE AVALIAÇÃO (CORRIGIDA - LEITURA ANTES DA ESCRITA)
export async function enviarAvaliacao(orderId, providerId, stars, complimentsArray, comment) {
    if(!auth.currentUser) return;

    try {
        const userRef = doc(db, "usuarios", providerId);
        const providerRef = doc(db, "active_providers", providerId);

        // TRANSAÇÃO ATÔMICA
        await runTransaction(db, async (transaction) => {
            // 1. LEITURAS (READS) - OBRIGATÓRIO SER PRIMEIRO
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "Usuário não existe!";
            
            // Tenta ler o doc do prestador (se existir)
            const providerDoc = await transaction.get(providerRef);

            // 2. CÁLCULOS (LÓGICA)
            const data = userDoc.data();
            let currentCount = data.rating_count || 0;
            let currentAvg = data.rating_avg || 5.0;
            let newCount = currentCount + 1;
            let newAvg = ((currentAvg * currentCount) + parseInt(stars)) / newCount;
            newAvg = Math.round(newAvg * 100) / 100; // Arredonda

            // 3. ESCRITAS (WRITES) - SÓ AGORA PODE ESCREVER
            
            // Atualiza Usuário
            transaction.update(userRef, {
                rating_avg: newAvg,
                rating_count: newCount
            });

            // Atualiza Vitrine (Se existir)
            if(providerDoc.exists()) {
                transaction.update(providerRef, { rating_avg: newAvg, rating_count: newCount });
            }
        });

        // 4. SALVA O REVIEW (Fora da transação para simplificar o ID, já que não afeta a média diretamente)
        await addDoc(collection(db, "reviews"), {
            order_id: orderId,
            from_user: auth.currentUser.uid,
            to_user: providerId,
            stars: parseInt(stars),
            compliments: complimentsArray,
            comment: comment,
            created_at: serverTimestamp()
        });

        return true;
    } catch (e) {
        console.error("Erro transação:", e);
        alert("Erro ao avaliar: " + e.message);
        return false;
    }
}

// Interface do Modal
export function abrirModalAvaliacao(orderId, providerId, providerName) {
    // Remove anterior se existir
    const antigo = document.getElementById('modal-review');
    if(antigo) antigo.remove();

    const div = document.createElement('div');
    div.id = 'modal-review';
    div.className = "fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn";
    div.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
            <div class="p-6 text-center">
                <button onclick="document.getElementById('modal-review').remove()" class="absolute top-4 right-4 text-gray-400 font-bold text-xl">&times;</button>
                <h3 class="text-lg font-black text-gray-800 mb-1">Avaliar ${providerName}</h3>
                <p class="text-xs text-gray-500 mb-6">Como foi o serviço?</p>
                
                <div class="flex justify-center gap-2 mb-6" id="star-container">
                    ${[1,2,3,4,5].map(i => `<button onclick="window.setStar(${i})" class="star-btn text-4xl text-gray-200 hover:scale-110 transition" data-val="${i}">★</button>`).join('')}
                </div>
                <input type="hidden" id="selected-star" value="0">

                <div class="flex flex-wrap gap-2 justify-center mb-4">
                    ${['Pontual ⏰', 'Educado 🤝', 'Profissional 💼', 'Rápido ⚡', 'Limpo ✨'].map(tag => 
                        `<button onclick="this.classList.toggle('bg-blue-100'); this.classList.toggle('text-blue-600');" class="tag-btn border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-500 transition">${tag}</button>`
                    ).join('')}
                </div>

                <textarea id="review-comment" class="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm mb-4" placeholder="Deixe um comentário..." rows="2"></textarea>
                
                <button onclick="window.confirmarAvaliacao('${orderId}', '${providerId}')" class="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg">ENVIAR AVALIAÇÃO</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

window.setStar = (val) => {
    document.getElementById('selected-star').value = val;
    document.querySelectorAll('.star-btn').forEach(b => {
        if(parseInt(b.dataset.val) <= val) b.style.color = "#FFD700";
        else b.style.color = "#E5E7EB";
    });
};

window.confirmarAvaliacao = async (oid, pid) => {
    const stars = document.getElementById('selected-star').value;
    if(stars == 0) return alert("Selecione as estrelas!");
    const tags = Array.from(document.querySelectorAll('.tag-btn.bg-blue-100')).map(b => b.innerText);
    const comment = document.getElementById('review-comment').value;

    const success = await enviarAvaliacao(oid, pid, stars, tags, comment);
    if(success) {
        document.getElementById('modal-review').remove();
        alert("✅ Avaliação enviada! Obrigado.");
    }
};

window.abrirModalAvaliacao = abrirModalAvaliacao;
