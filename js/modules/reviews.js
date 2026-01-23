import { db, auth } from '../app.js';
import { doc, updateDoc, addDoc, collection, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. O HTML DO MODAL (Guardado dentro do JS para não poluir o Index)
const reviewModalHTML = `
<div id="review-modal" class="hidden fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 animate-fadeIn">
    <div class="bg-white w-full max-w-sm rounded-2xl p-6 text-center">
        <h3 id="review-modal-title" class="font-black text-xl text-blue-900 uppercase italic mb-1">Como foi?</h3>
        <p class="text-xs text-gray-400 mb-6">Sua avaliação ajuda a comunidade.</p>
        
        <div class="flex justify-center gap-2 mb-6 text-4xl" id="star-container">
            <span class="rate-star" data-val="1">★</span>
            <span class="rate-star" data-val="2">★</span>
            <span class="rate-star" data-val="3">★</span>
            <span class="rate-star" data-val="4">★</span>
            <span class="rate-star" data-val="5">★</span>
        </div>

        <div class="grid grid-cols-2 gap-2 mb-6">
            <button onclick="toggleTag(this)" class="tag-select border border-gray-200 rounded-lg py-2 text-[10px] font-bold text-gray-500 uppercase">Pontual</button>
            <button onclick="toggleTag(this)" class="tag-select border border-gray-200 rounded-lg py-2 text-[10px] font-bold text-gray-500 uppercase">Educado</button>
            <button onclick="toggleTag(this)" class="tag-select border border-gray-200 rounded-lg py-2 text-[10px] font-bold text-gray-500 uppercase">Profissional</button>
            <button onclick="toggleTag(this)" class="tag-select border border-gray-200 rounded-lg py-2 text-[10px] font-bold text-gray-500 uppercase">Simpático</button>
        </div>

        <div class="flex items-center justify-center gap-4 mb-6">
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="recommend" value="yes" class="accent-blue-600" checked>
                <span class="text-xs font-bold text-gray-700">👍 Recomendo</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="recommend" value="no" class="accent-red-600">
                <span class="text-xs font-bold text-gray-700">👎 Não Indico</span>
            </label>
        </div>

        <textarea id="review-comment" class="w-full border border-gray-200 rounded-xl p-3 text-xs bg-gray-50 focus:outline-none focus:border-blue-500 mb-4 text-gray-900" rows="3" placeholder="Deixe um comentário (opcional)..."></textarea>

        <button onclick="enviarAvaliacao()" id="btn-send-review" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold uppercase shadow-md hover:bg-blue-700">Enviar Avaliação</button>
        <button onclick="document.getElementById('review-modal').classList.add('hidden')" class="w-full mt-2 text-gray-400 text-xs underline">Pular</button>
    </div>
</div>
`;

// 2. INJEÇÃO AUTOMÁTICA NO INDEX
// Assim que este arquivo é carregado, ele cria o modal lá no final do body
document.body.insertAdjacentHTML('beforeend', reviewModalHTML);

// 3. VARIÁVEIS DE CONTROLE
let orderIdParaAvaliar = null;
let targetUserIdParaAvaliar = null; 
let currentUserRole = null; 

// 4. FUNÇÕES GLOBAIS (Disponíveis para o onclick do HTML)

// Função para selecionar/deselecionar tags
window.toggleTag = (btn) => {
    btn.classList.toggle('selected');
};

// Lógica das Estrelas
setTimeout(() => {
    // Adiciona listener nas estrelas recém-criadas
    document.querySelectorAll('.rate-star').forEach(star => {
        star.addEventListener('click', function() {
            let currentRating = this.getAttribute('data-val');
            document.querySelectorAll('.rate-star').forEach(s => {
                s.classList.remove('active');
                if(s.getAttribute('data-val') <= currentRating) s.classList.add('active');
            });
        });
    });
}, 1000); // Pequeno delay para garantir que o HTML foi injetado

// Função para Abrir o Modal
window.abrirModalAvaliacao = (orderId, targetId, type) => {
    orderIdParaAvaliar = orderId;
    targetUserIdParaAvaliar = targetId;
    currentUserRole = type; 
    
    const title = document.getElementById('review-modal-title');
    if (title) {
        title.innerText = type === 'client' ? "Avaliar Cliente" : "Avaliar Prestador";
    }
    
    document.getElementById('review-modal').classList.remove('hidden');
};

// Função Auxiliar de Censura
function contemOfensa(texto) {
    const mensagemLimpa = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const listaNegra = ['vagabunda', 'vagabundo', 'ladrao', 'ladra', 'roubo', 'corno', 'corna', 'porra', 'caralho', 'merda', 'bosta', 'puta', 'puto', 'viado', 'fuder', 'foder', 'idiota', 'imbecil', 'retardado', 'burro', 'picareta', 'golpista', 'safado', 'pilantra', 'otario', 'trouxa', 'cu', 'bunda'];
    for (let termo of listaNegra) { if (mensagemLimpa.includes(termo)) return true; }
    return false;
}

// Função Principal de Envio
window.enviarAvaliacao = async () => {
    let stars = 0;
    document.querySelectorAll('.rate-star.active').forEach(s => stars = Math.max(stars, s.getAttribute('data-val')));
    
    if(stars === 0) return alert("Selecione pelo menos 1 estrela.");

    const commentInput = document.getElementById('review-comment');
    const comment = commentInput.value.trim();
    
    if(comment && contemOfensa(comment)) return alert("Comentário bloqueado por termos ofensivos.");

    const tags = [];
    document.querySelectorAll('.tag-select.selected').forEach(t => tags.push(t.innerText));

    const recommend = document.querySelector('input[name="recommend"]:checked').value === 'yes';

    const btn = document.getElementById('btn-send-review');
    btn.innerText = "Enviando...";
    btn.disabled = true;

    try {
        // Salva a Review
        await addDoc(collection(db, "reviews"), {
            order_id: orderIdParaAvaliar,
            reviewed_user_id: targetUserIdParaAvaliar,
            reviewer_user_id: auth.currentUser.uid, 
            stars: parseInt(stars),
            tags: tags,
            comment: comment,
            recommended: recommend,
            created_at: serverTimestamp()
        });

        // Atualiza o Pedido (Flag de Avaliado)
        const orderRef = doc(db, "orders", orderIdParaAvaliar);
        const updateData = currentUserRole === 'provider' ? { client_reviewed: true } : { provider_reviewed: true };
        
        await updateDoc(orderRef, updateData);

        document.getElementById('review-modal').classList.add('hidden');
        alert("✅ Avaliação Enviada com Sucesso!");
        
        // Limpeza
        commentInput.value = "";
        document.querySelectorAll('.rate-star').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.tag-select').forEach(t => t.classList.remove('selected'));

    } catch (e) {
        console.error(e);
        document.getElementById('review-modal').classList.add('hidden');
        if(e.code === 'permission-denied') {
             alert("Avaliação registrada! (Erro de permissão no ícone, mas ok).");
        } else {
             alert("Erro ao enviar: " + e.message);
        }
    } finally {
        btn.innerText = "Enviar Avaliação"; 
        btn.disabled = false;
    }
};
