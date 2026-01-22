import { db, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- LÓGICA DO PRESTADOR ---

export async function toggleOnlineStatus(isOnline) {
    if(!auth.currentUser || !userProfile) return;
    
    const statusMsg = document.getElementById('status-msg');
    
    if(isOnline) {
        // Pergunta simples para configurar o anúncio rápido
        const especialidade = prompt("Qual serviço você vai prestar agora? (Ex: Eletricista, Frete)");
        const preco = prompt("Qual seu valor base? (Ex: R$ 50 visita)");

        if(!especialidade || !preco) {
            document.getElementById('online-toggle').checked = false;
            return;
        }

        // Atualiza status no banco
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
            
        monitorarChamados();

    } else {
        // Fica Offline
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { status: "offline" });
        
        if(statusMsg) statusMsg.innerHTML = `
            <p class="text-4xl mb-2">😴</p>
            <p class="font-bold text-sm text-gray-400">Você está Offline</p>
            <p class="text-xs text-gray-500">Ative o botão "Trabalhar" para aparecer no mapa.</p>`;
    }
}

// Escuta chamados recebidos (Futuro: Tocar som)
function monitorarChamados() {
    const container = document.getElementById('lista-chamados');
    if(!container) return;

    // Aqui entra a query de "Pedidos direcionados a mim"
    // Por enquanto, deixamos preparado.
    container.innerHTML = `<p class="text-xs text-center mt-4 text-gray-400">Buscando clientes na região...</p>`;
    container.classList.remove('hidden');
}


// --- LÓGICA DO CLIENTE ---

export function carregarPrestadoresOnline() {
    const container = document.getElementById('servicos-cliente');
    if(!container || !userProfile) return;

    // Limpa apenas a lista de profissionais, mantendo o destaque oficial
    // Vamos criar um container dinâmico se não existir
    let listaDinamica = document.getElementById('lista-profissionais-realtime');
    if(!listaDinamica) {
        listaDinamica = document.createElement('div');
        listaDinamica.id = 'lista-profissionais-realtime';
        listaDinamica.className = 'grid grid-cols-2 gap-3 mt-4';
        container.appendChild(listaDinamica);
    }

    // Busca apenas quem está ONLINE e é da mesma cidade
    const q = query(
        collection(db, "usuarios"), 
        where("is_provider", "==", true),
        where("status", "==", "online"),
        where("tenant_id", "==", userProfile.tenant_id)
    );

    onSnapshot(q, (snap) => {
        listaDinamica.innerHTML = "";
        
        if(snap.empty) {
            listaDinamica.innerHTML = `<div class="col-span-2 text-center py-8 text-gray-400 text-xs bg-gray-50 rounded-xl border border-gray-100"><p>Nenhum prestador online agora.</p></div>`;
        } else {
            snap.forEach(d => {
                const p = d.data();
                // Card do Prestador
                listaDinamica.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between h-32 hover:border-blue-500 transition cursor-pointer" onclick="iniciarContratacao('${d.id}', '${p.profissao_atual}')">
                        <div class="flex justify-between items-start">
                            <span class="text-2xl bg-blue-50 rounded-lg p-1">🛠️</span>
                            <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        </div>
                        <div>
                            <h4 class="font-bold text-xs uppercase text-blue-900 leading-tight">${p.profissao_atual}</h4>
                            <p class="text-[10px] text-gray-500 mt-1">${p.preco_base}</p>
                        </div>
                        <button class="w-full bg-blue-600 text-white text-[9px] font-bold py-1 rounded mt-2 uppercase">Contratar</button>
                    </div>`;
            });
        }
    });
}

// Função global para iniciar contratação (Abre Chat)
window.iniciarContratacao = async (prestadorId, servicoNome) => {
    // 1. Cria uma "Order" (Pedido)
    // 2. Abre o chat vinculado a essa Order
    // (Implementaremos na próxima fase de "Chat Transacional")
    alert(`Iniciando negociação com ${servicoNome}... (Chat abrirá em breve)`);
};

// Inicializa escuta do botão toggle
const toggleBtn = document.getElementById('online-toggle');
if(toggleBtn) {
    toggleBtn.addEventListener('change', (e) => {
        toggleOnlineStatus(e.target.checked);
    });
}

// Auto-carregar para clientes
setInterval(() => {
    const sec = document.getElementById('sec-servicos');
    if(sec && !sec.classList.contains('hidden') && !userProfile.is_provider) {
        carregarPrestadoresOnline();
    }
}, 5000);
