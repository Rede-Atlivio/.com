import { db, auth } from '../app.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variáveis de Negociação
let targetProviderId = null;
let serviceBasePrice = 0;
let currentOffer = 0;

// Expor função globalmente para o botão "Solicitar" funcionar
window.abrirModalSolicitacao = (providerId, providerName, price) => {
    targetProviderId = providerId;
    serviceBasePrice = parseFloat(price);
    currentOffer = serviceBasePrice;

    // Preenche o Modal
    document.getElementById('target-provider-id').value = providerId;
    document.getElementById('service-base-price').value = price;
    
    // Reseta inputs
    document.getElementById('req-value').value = price;
    document.getElementById('req-value').disabled = true;
    document.getElementById('radio-custom').checked = false;
    
    // Atualiza Calculadora
    atualizarResumoFinanceiro(serviceBasePrice);

    // Mostra Modal
    document.getElementById('request-modal').classList.remove('hidden');
};

window.selecionarDesconto = (percent) => {
    // Aplica desconto (0.05, 0.10, 0.15)
    currentOffer = serviceBasePrice * (1 - percent);
    document.getElementById('req-value').value = currentOffer.toFixed(2);
    atualizarResumoFinanceiro(currentOffer);
};

window.ativarInputPersonalizado = () => {
    const input = document.getElementById('req-value');
    input.disabled = false;
    input.focus();
};

window.validarOferta = (val) => {
    const offer = parseFloat(val);
    const min = serviceBasePrice * 0.8; // Max 20% desconto
    const max = serviceBasePrice * 1.3; // Max 30% gorjeta

    const erroEl = document.getElementById('msg-erro-valor');
    const btn = document.getElementById('btn-confirm-req');

    if (offer < min || offer > max || isNaN(offer)) {
        erroEl.classList.remove('hidden');
        document.getElementById('val-min').innerText = min.toFixed(2);
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        erroEl.classList.add('hidden');
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        atualizarResumoFinanceiro(offer);
    }
};

function atualizarResumoFinanceiro(valor) {
    // Regra de Negócio: Taxa de 10%
    const taxa = valor * 0.10;
    // Reserva de Segurança 30% (opcional, regra do blueprint)
    const reserva = valor * 0.30; 
    
    const total = valor + taxa; // Cliente paga Serviço + Taxa

    document.getElementById('financial-summary').classList.remove('hidden');
    document.getElementById('calc-security').innerText = `R$ ${reserva.toFixed(2)}`;
    document.getElementById('calc-fee').innerText = `R$ ${taxa.toFixed(2)}`;
    document.getElementById('calc-total-reserva').innerText = `R$ ${total.toFixed(2)}`;
    
    currentOffer = valor;
}

window.enviarPropostaAgora = async () => {
    if(!targetProviderId || !currentOffer) return;
    
    const btn = document.getElementById('btn-confirm-req');
    btn.innerText = "ENVIANDO...";
    btn.disabled = true;

    try {
        const orderData = {
            client_id: auth.currentUser.uid,
            provider_id: targetProviderId,
            status: 'pending', // pending -> accepted -> paid -> completed
            offer_value: currentOffer,
            base_price: serviceBasePrice,
            service_date: document.getElementById('req-date').value,
            service_time: document.getElementById('req-time').value,
            location: document.getElementById('req-local').value,
            created_at: serverTimestamp()
        };

        // Salva Pedido
        const docRef = await addDoc(collection(db, "orders"), orderData);

        // Cria Chat Automático de Negociação
        await addDoc(collection(db, `chats/${docRef.id}/messages`), {
            text: `👋 Olá! Enviei uma proposta de R$ ${currentOffer.toFixed(2)} para o serviço.`,
            sender_id: auth.currentUser.uid,
            timestamp: serverTimestamp()
        });

        await setDoc(doc(db, "chats", docRef.id), {
            mission_title: "Negociação de Serviço",
            participants: [auth.currentUser.uid, targetProviderId],
            last_message: "Nova proposta recebida.",
            updated_at: serverTimestamp()
        });

        alert("✅ Proposta Enviada! Aguarde a resposta no Chat.");
        document.getElementById('request-modal').classList.add('hidden');
    } catch (e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "ENVIAR PROPOSTA 🚀";
        btn.disabled = false;
    }
};
