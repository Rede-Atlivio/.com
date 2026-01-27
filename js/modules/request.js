import { db, auth } from '../app.js';
import { collection, addDoc, serverTimestamp, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let targetProviderId = null;
let targetProviderName = null;
let serviceBasePrice = 0;
let currentOffer = 0;

export function abrirModalSolicitacao(providerId, providerName, price) {
    if(!auth.currentUser) return alert("Faça login para solicitar!");
    targetProviderId = providerId;
    targetProviderName = providerName;
    serviceBasePrice = parseFloat(price);
    currentOffer = serviceBasePrice;

    document.getElementById('target-provider-id').value = providerId;
    document.getElementById('service-base-price').value = price;
    
    const inputValor = document.getElementById('req-value');
    if(inputValor) {
        inputValor.value = serviceBasePrice.toFixed(2);
        inputValor.disabled = true;
    }
    document.getElementById('request-modal').classList.remove('hidden');
}

export function selecionarDesconto(percent) {
    const discountValue = serviceBasePrice * percent;
    currentOffer = serviceBasePrice - discountValue;
    const inputValor = document.getElementById('req-value');
    if(inputValor) inputValor.value = currentOffer.toFixed(2);
}

export function ativarInputPersonalizado() {
    const input = document.getElementById('req-value');
    if(input) { input.disabled = false; input.focus(); }
}

export function validarOferta(val) {
    const offer = parseFloat(val);
    const min = serviceBasePrice * 0.80;
    const btn = document.getElementById('btn-confirm-req');
    
    if (isNaN(offer) || offer < min) {
        if(btn) btn.disabled = true;
    } else {
        if(btn) btn.disabled = false;
        currentOffer = offer;
    }
}

export async function enviarPropostaAgora() {
    const btn = document.getElementById('btn-confirm-req');
    btn.innerText = "ENVIANDO...";
    btn.disabled = true;

    try {
        const orderData = {
            client_id: auth.currentUser.uid,
            client_name: auth.currentUser.displayName,
            provider_id: targetProviderId,
            provider_name: targetProviderName,
            status: 'pending',
            offer_value: currentOffer,
            service_date: document.getElementById('req-date').value,
            service_time: document.getElementById('req-time').value,
            location: document.getElementById('req-local').value,
            created_at: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "orders"), orderData);
        alert("✅ Proposta Enviada!");
        document.getElementById('request-modal').classList.add('hidden');
    } catch (e) {
        console.error(e);
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "ENVIAR PROPOSTA 🚀";
        btn.disabled = false;
    }
}

// EXPOSIÇÃO GLOBAL NECESSÁRIA PARA O HTML ENCONTRAR AS FUNÇÕES
window.abrirModalSolicitacao = abrirModalSolicitacao;
window.selecionarDesconto = selecionarDesconto;
window.ativarInputPersonalizado = ativarInputPersonalizado;
window.validarOferta = validarOferta;
window.enviarPropostaAgora = enviarPropostaAgora;
