import { db, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variável de controle para evitar múltiplos ouvintes do Firebase
let listenerAtivo = false;

// --- LÓGICA DO PRESTADOR ---

export async function toggleOnlineStatus(isOnline) {
    if(!auth.currentUser || !userProfile) return;
    
    const statusMsg = document.getElementById('status-msg');
    
    if(isOnline) {
        const especialidade = prompt("Qual serviço você vai prestar agora? (Ex: Eletricista, Frete)");
        const preco = prompt("Qual seu valor base? (Ex: R$ 50 a visita)");

        if(!especialidade || !preco) {
            document.getElementById('online-toggle').checked = false;
            return;
        }

        // Atualiza status no banco para ONLINE
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            status: "online",
            profissao_atual: especialidade,
            preco_base: preco,
            ultima_atividade: new Date()
        });

        if(statusMsg) statusMsg.innerHTML = `
            <div class="animate-pulse">
                <p class="text-4xl mb-2">📡</p>
                <p class="text-green-600 font-bold text-sm uppercase">Você está Online</p>
                <p class="text-xs text-gray-500">Aparecendo como: <b>${especialidade}</b></p>
                <p class="text-[9px] mt-2">Aguarde o chamado tocar aqui.</p>
            </div>`;

    } else {
        // Atualiza status no banco para OFFLINE
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { status: "offline" });
        
        if(statusMsg) statusMsg.innerHTML = `
            <p class="text-4xl mb-2">😴</p>
            <p class="font-bold text-sm text-gray-400">Você está Offline</p>
            <p class="text-xs text-gray-500">Ative o botão "Trabalhar" no topo para aparecer.</p>`;
    }
}


// --- LÓGICA DO CLIENTE ---

export function carregarPrestadoresOnline() {
    const containerPrincipal = document.getElementById('servicos-cliente'); // ID da seção pai
    if(!containerPrincipal || !userProfile) return;

    // ROBUSTEZ: Verifica se o container da lista existe, se não, cria.
    let listaContainer = document.getElementById('lista-profissionais-realtime');
    if(!listaContainer) {
        listaContainer = document.createElement('div');
        listaContainer.id = 'lista-profissionais-realtime';
        listaContainer.className = 'grid grid-cols-2 gap-3 mt-4'; // Grid para cards
        containerPrincipal.appendChild(listaContainer);
    }

    // Busca apenas quem está ONLINE, é PRESTADOR e é da mesma CIDADE
    const q = query(
        collection(db, "usuarios"), 
        where("is_provider", "==", true),
        where("status", "==", "online"),
        where("tenant_id", "==", userProfile.tenant_id)
    );

    // INICIA O LISTENNER (TEMPO REAL)
    onSnapshot(q, (snap) => {
        listaContainer.innerHTML = "";
        
        if(snap.empty) {
            listaContainer.innerHTML = `<div class="col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-100 text-center text-gray-400 text-xs"><p>Nenhum profissional online na sua região agora.</p></div>`;
        } else {
            snap.forEach(d => {
                const p = d.data();
                // Renderiza o Card
                listaContainer.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between mb-0 hover:border-blue-500 transition cursor-pointer h-full" onclick="iniciarContratacao('${d.id}', '${p.profissao_atual}')">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-2xl bg-blue-50 rounded-lg p-1">🛠️</span>
                            <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        </div>
                        <div>
                            <h4 class="font-bold text-xs uppercase text-blue-900 leading-tight">${p.profissao_atual || 'Prestador'}</h4>
                            <p class="text-[10px] text-gray-500 mt-1">${p.preco_base || 'A combinar'}</p>
                        </div>
                        <button class="w-full bg-blue-600 text-white text-[9px] font-bold py-2 rounded mt-3 uppercase shadow-sm">Contratar</button>
                    </div>`;
            });
        }
    });
}

// Função placeholder para evitar erro ao clicar (Mantido da versão anterior para não quebrar)
window.iniciarContratacao = (id, nome) => {
    alert(`O sistema de chat com ${nome} será ativado na próxima etapa.`);
}


// --- INICIALIZAÇÃO SEGURA ---

// 1. Botão Toggle (Prestador)
const toggleBtn = document.getElementById('online-toggle');
if(toggleBtn) {
    toggleBtn.addEventListener('change', (e) => {
        toggleOnlineStatus(e.target.checked);
    });
}

// 2. Monitoramento de Tela (Cliente)
// Verifica a cada 2s se a tela de serviços apareceu. 
// SE aparecer E ainda não tiver ativado o listener, ele ativa UMA VEZ.
setInterval(() => {
    const sec = document.getElementById('sec-servicos');
    
    // Condições: Seção visível + Usuário não é prestador + Listener nunca foi ativado
    if(sec && !sec.classList.contains('hidden') && !userProfile.is_provider && !listenerAtivo) {
        console.log("Auditor: Iniciando monitoramento em tempo real de prestadores...");
        carregarPrestadoresOnline();
        listenerAtivo = true; // TRAVA DE SEGURANÇA: Impede que rode novamente
    }
}, 2000);
