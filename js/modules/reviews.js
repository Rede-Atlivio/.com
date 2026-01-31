import { db, auth } from '../app.js';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 10. LÓGICA DE AVALIAÇÃO (UBER STYLE)
export async function enviarAvaliacao(orderId, providerId, stars, complimentsArray, comment) {
    if(!auth.currentUser) return;

    try {
        // 1. Salva a Review individual
        await addDoc(collection(db, "reviews"), {
            order_id: orderId,
            from_user: auth.currentUser.uid,
            to_user: providerId,
            stars: parseInt(stars),
            compliments: complimentsArray, // ['pontual', 'educado']
            comment: comment,
            created_at: serverTimestamp()
        });

        // 2. Atualiza a Média do Usuário (Atomicamente)
        const userRef = doc(db, "usuarios", providerId);
        
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "Usuário não existe!";

            const data = userDoc.data();
            
            // LÓGICA "ÚLTIMAS 100" (Simplificada para Firestore sem arrays gigantes)
            // Mantemos um contador total e uma média móvel. 
            // Para "últimas 100" exato, precisaríamos de um array circular. 
            // Vamos usar Média Ponderada Acumulativa que converge para o recente, 
            // ou a média aritmética padrão se for < 100.
            
            let currentCount = data.rating_count || 0;
            let currentAvg = data.rating_avg || 5.0;

            let newCount = currentCount + 1;
            
            // Fórmula da Média Aritmética: NewAvg = ((OldAvg * OldCount) + NewStar) / NewCount
            let newAvg = ((currentAvg * currentCount) + stars) / newCount;

            // Arredonda para 2 casas
            newAvg = Math.round(newAvg * 100) / 100;

            transaction.update(userRef, {
                rating_avg: newAvg,
                rating_count: newCount
            });

            // Atualiza também na coleção de vitrine se existir (para ordenar rápido)
            const providerRef = doc(db, "active_providers", providerId);
            const providerDoc = await transaction.get(providerRef);
            if(providerDoc.exists()) {
                transaction.update(providerRef, { rating_avg: newAvg, rating_count: newCount });
            }
        });

        return true;
    } catch (e) {
        console.error("Erro ao avaliar:", e);
        return false;
    }
}

// Interface do Modal de Avaliação
export function abrirModalAvaliacao(orderId, providerId, providerName) {
    const div = document.createElement('div');
    div.id = 'modal-review';
    div.className = "fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn";
    div.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
            <div class="p-6 text-center">
                <h3 class="text-lg font-black text-gray-800 mb-1">Avaliar ${providerName}</h3>
                <p class="text-xs text-gray-500 mb-6">Como foi o serviço?</p>
                
                <div class="flex justify-center gap-2 mb-6" id="star-container">
                    ${[1,2,3,4,5].map(i => `<button onclick="window.setStar(${i})" class="star-btn text-4xl text-gray-200 hover:scale-110 transition" data-val="${i}">★</button>`).join('')}
                </div>
                <input type="hidden" id="selected-star" value="0">

                <p class="text-[10px] font-bold text-gray-400 uppercase mb-2">O QUE SE DESTACOU?</p>
                <div class="flex flex-wrap gap-2 justify-center mb-4" id="tags-container">
                    ${['Pontual ⏰', 'Educado 🤝', 'Profissional 💼', 'Rápido ⚡', 'Limpo ✨'].map(tag => 
                        `<button onclick="this.classList.toggle('bg-blue-100'); this.classList.toggle('text-blue-600'); this.classList.toggle('border-blue-200');" class="tag-btn border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-500 transition">${tag}</button>`
                    ).join('')}
                </div>

                <textarea id="review-comment" class="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm mb-4" placeholder="Deixe um comentário (opcional)..." rows="2"></textarea>
                
                <button onclick="window.confirmarAvaliacao('${orderId}', '${providerId}')" class="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg">ENVIAR AVALIAÇÃO</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

// Helpers Globais
window.setStar = (val) => {
    document.getElementById('selected-star').value = val;
    document.querySelectorAll('.star-btn').forEach(b => {
        if(parseInt(b.dataset.val) <= val) b.style.color = "#FFD700"; // Gold
        else b.style.color = "#E5E7EB"; // Gray
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
        alert("✅ Avaliação enviada! Obrigado por ajudar a comunidade.");
    }
};

window.abrirModalAvaliacao = abrirModalAvaliacao;
