import { db, auth } from '../app.js';
import { collection, addDoc, serverTimestamp, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variáveis de Estado da Negociação
let targetProviderId = null;
let targetProviderName = null;
let serviceBasePrice = 0;
let currentOffer = 0;

// --- 1. ABRIR O MODAL (GATILHO) ---
window.abrirModalSolicitacao = (providerId, providerName, price) => {
    if(!auth.currentUser) return alert("Faça login para solicitar!");

    targetProviderId = providerId;
    targetProviderName = providerName;
    serviceBasePrice = parseFloat(price);
    currentOffer = serviceBasePrice;

    // Preenche UI Inicial
    document.getElementById('target-provider-id').value = providerId;
    document.getElementById('service-base-price').value = price;
    
    // Reseta Inputs
    const inputValor = document.getElementById('req-value');
    inputValor.value = serviceBasePrice.toFixed(2);
    inputValor.disabled = true; // Começa travado (incentiva botões rápidos)
    document.getElementById('radio-custom').checked = false;
    
    // Limpa erros
    document.getElementById('msg-erro-valor').classList.add('hidden');
    document.getElementById('btn-confirm-req').disabled = false;
    document.getElementById('btn-confirm-req').classList.remove('opacity-50', 'cursor-not-allowed');

    // Reseta visual dos botões de desconto
    resetDiscountButtons();

    // Calcula valores iniciais (Preço cheio)
    atualizarResumoFinanceiro(serviceBasePrice);

    // Mostra Modal
    document.getElementById('request-modal').classList.remove('hidden');
};

// --- 2. LÓGICA DE DESCONTO RÁPIDO (-5%, -10%, -15%) ---
window.selecionarDesconto = (percent) => {
    // 1. Visual: Marca o botão selecionado
    resetDiscountButtons();
    const btnId = `btn-desc-${percent * 100}`;
    const btn = document.getElementById(btnId);
    if(btn) {
        btn.classList.remove('bg-green-50', 'text-green-700', 'border-green-200');
        btn.classList.add('bg-green-600', 'text-white', 'border-green-600', 'shadow-md');
    }

    // 2. Lógica: Calcula novo valor
    const discountValue = serviceBasePrice * percent;
    currentOffer = serviceBasePrice - discountValue;

    // 3. UI: Atualiza input e resumo
    document.getElementById('req-value').value = currentOffer.toFixed(2);
    document.getElementById('req-value').disabled = true; // Trava input manual
    document.getElementById('radio-custom').checked = false;
    
    atualizarResumoFinanceiro(currentOffer);
};

function resetDiscountButtons() {
    [5, 10, 15].forEach(p => {
        const btn = document.getElementById(`btn-desc-${p}`);
        if(btn) {
            btn.className = "border border-green-200 bg-green-50 text-green-700 py-2 rounded-lg font-bold text-xs hover:bg-green-100 transition";
        }
    });
}

// --- 3. LÓGICA DE VALOR PERSONALIZADO (Manual) ---
window.ativarInputPersonalizado = () => {
    resetDiscountButtons(); // Tira seleção dos botões
    const input = document.getElementById('req-value');
    input.disabled = false;
    input.focus();
    // Revalida o que estiver lá
    window.validarOferta(input.value);
};

window.validarOferta = (val) => {
    const offer = parseFloat(val);
    const min = serviceBasePrice * 0.80; // Mínimo: -20%
    const max = serviceBasePrice * 1.30; // Máximo: +30%

    const erroEl = document.getElementById('msg-erro-valor');
    const btn = document.getElementById('btn-confirm-req');
    const valMinEl = document.getElementById('val-min');

    if (isNaN(offer) || offer < min || offer > max) {
        // BLOQUEIA
        erroEl.classList.remove('hidden');
        if(valMinEl) valMinEl.innerText = min.toFixed(2);
        
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        
        // Esconde resumo financeiro se inválido
        document.getElementById('financial-summary').classList.add('hidden');
    } else {
        // LIBERA
        erroEl.classList.add('hidden');
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        
        atualizarResumoFinanceiro(offer);
    }
};

// --- 4. CÁLCULO FINANCEIRO (O PULO DO GATO) ---
function atualizarResumoFinanceiro(valor) {
    // Regra do Projeto:
    // Reserva = 30% do valor ofertado (Garante o prestador)
    // Taxa = 10% do valor ofertado (Sustenta a Atlivio)
    // Cliente Paga Agora = Reserva + Taxa
    
    const reserva = valor * 0.30; 
    const taxa = valor * 0.10;
    const totalPagarAgora = reserva + taxa;

    document.getElementById('financial-summary').classList.remove('hidden');
    
    // Atualiza textos na tela
    document.getElementById('calc-security').innerText = `R$ ${reserva.toFixed(2)}`;
    document.getElementById('calc-fee').innerText = `R$ ${taxa.toFixed(2)}`;
    document.getElementById('calc-total-reserva').innerText = `R$ ${totalPagarAgora.toFixed(2)}`;
    
    currentOffer = valor;
}

// --- 5. ENVIAR PROPOSTA (CRIA O PEDIDO) ---
window.enviarPropostaAgora = async () => {
    if(!targetProviderId || !currentOffer) return;
    
    const btn = document.getElementById('btn-confirm-req');
    const originalText = btn.innerText;
    btn.innerText = "ENVIANDO...";
    btn.disabled = true;

    try {
        // Dados do Pedido (Payload)
        const orderData = {
            client_id: auth.currentUser.uid,
            client_name: auth.currentUser.displayName || "Cliente",
            provider_id: targetProviderId,
            provider_name: targetProviderName,
            
            status: 'pending', // pending -> accepted -> paid -> completed
            
            base_price: serviceBasePrice,
            offer_value: currentOffer, // Valor final acordado
            
            // Valores calculados
            reservation_amount: currentOffer * 0.30,
            platform_fee: currentOffer * 0.10,
            total_paid_now: (currentOffer * 0.30) + (currentOffer * 0.10),
            remaining_amount: currentOffer * 0.70, // O que falta pagar ao final

            service_date: document.getElementById('req-date').value || "A combinar",
            service_time: document.getElementById('req-time').value || "A combinar",
            location: document.getElementById('req-local').value || "A combinar",
            
            created_at: serverTimestamp()
        };

        // 1. Salva Pedido na coleção 'orders'
        const docRef = await addDoc(collection(db, "orders"), orderData);

        // 2. Cria Chat Automático (Ainda bloqueado para mensagens livres, mas inicia o canal)
        const msgTexto = `👋 Olá! Fiz uma proposta de R$ ${currentOffer.toFixed(2)} (Reserva garantida de R$ ${(currentOffer * 0.30).toFixed(2)}). Aguardo seu aceite!`;
        
        await addDoc(collection(db, `chats/${docRef.id}/messages`), {
            text: msgTexto,
            sender_id: auth.currentUser.uid,
            timestamp: serverTimestamp(),
            system_msg: true // Flag para diferenciar msg de sistema
        });

        // 3. Cria o índice do Chat
        await setDoc(doc(db, "chats", docRef.id), {
            mission_title: `Serviço: ${targetProviderName}`,
            participants: [auth.currentUser.uid, targetProviderId],
            order_id: docRef.id,
            last_message: "Proposta enviada.",
            updated_at: serverTimestamp(),
            status: "pending_approval" // Chat travado até aceite
        });

        alert(`✅ Proposta Enviada!\n\nSe o prestador aceitar, você será notificado para realizar o pagamento da reserva (R$ ${(currentOffer * 0.40).toFixed(2)}).`);
        document.getElementById('request-modal').classList.add('hidden');

    } catch (e) {
        console.error(e);
        alert("Erro ao enviar: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};
