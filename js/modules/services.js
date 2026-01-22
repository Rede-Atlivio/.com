import { db, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variável de controle (Trava de Segurança de Memória)
let listenerAtivo = false;

// --- LÓGICA DO PRESTADOR (BOTÃO TRABALHAR) ---

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

        // Fica ONLINE
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
        // Fica OFFLINE
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { status: "offline" });
        
        if(statusMsg) statusMsg.innerHTML = `
            <p class="text-4xl mb-2">😴</p>
            <p class="font-bold text-sm text-gray-400">Você está Offline</p>
            <p class="text-xs text-gray-500">Ative o botão "Trabalhar" no topo para aparecer.</p>`;
    }
}


// --- LÓGICA DO CLIENTE (LISTA EM TEMPO REAL) ---

export function carregarPrestadoresOnline() {
    const containerPrincipal = document.getElementById('servicos-cliente');
    if(!containerPrincipal || !userProfile) return;

    let listaContainer = document.getElementById('lista-profissionais-realtime');
    if(!listaContainer) {
        listaContainer = document.createElement('div');
        listaContainer.id = 'lista-profissionais-realtime';
        listaContainer.className = 'grid grid-cols-2 gap-3 mt-4';
        containerPrincipal.appendChild(listaContainer);
    }

    const q = query(
        collection(db, "usuarios"), 
        where("is_provider", "==", true),
        where("status", "==", "online"),
        where("tenant_id", "==", userProfile.tenant_id)
    );

    onSnapshot(q, (snap) => {
        listaContainer.innerHTML = "";
        
        if(snap.empty) {
            listaContainer.innerHTML = `<div class="col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-100 text-center text-gray-400 text-xs"><p>Nenhum profissional online na sua região agora.</p></div>`;
        } else {
            snap.forEach(d => {
                const p = d.data();
                const prestadorUid = d.id; 
                
                listaContainer.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between mb-0 hover:border-blue-500 transition cursor-pointer h-full" onclick="iniciarContratacao('${prestadorUid}', '${p.profissao_atual}')">
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

// --- FUNÇÃO CORE: INICIAR CONTRATAÇÃO (GLOBAL) ---
// Essa função é chamada pelo onclick do HTML injetado acima

window.iniciarContratacao = async (prestadorId, servicoNome) => {
    // 1. Validações Básicas
    if(!auth.currentUser) return alert("Erro: Você precisa estar logado.");
    if(prestadorId === auth.currentUser.uid) return alert("Você não pode contratar seus próprios serviços.");

    const confirmacao = confirm(`Deseja iniciar uma negociação para: ${servicoNome}?`);
    if(!confirmacao) return;

    try {
        console.log("Iniciando criação de sala de chat...");

        // 2. Cria a sala de Chat (Parent Document)
        const chatRef = await addDoc(collection(db, "chats"), {
            participants: [auth.currentUser.uid, prestadorId], // Array de participantes para filtro
            mission_title: `Serviço: ${servicoNome}`,
            last_message: "👋 Olá! Tenho interesse no serviço.",
            updated_at: serverTimestamp(),
            created_at: serverTimestamp(),
            status: "open",
            client_id: auth.currentUser.uid,
            provider_id: prestadorId,
            tenant_id: userProfile.tenant_id // Mantém isolamento por cidade
        });

        // 3. Insere a primeira mensagem automática (Subcollection)
        await addDoc(collection(db, `chats/${chatRef.id}/messages`), {
            text: `Olá! Gostaria de contratar o serviço de ${servicoNome}. Podemos negociar?`,
            sender_id: auth.currentUser.uid,
            timestamp: serverTimestamp()
        });

        // 4. Redirecionamento e UX
        alert("✅ Solicitação enviada! Abrindo chat...");
        
        // Verifica se a função de navegação existe
        if(window.switchTab) {
            window.switchTab('chat');
        } else {
            console.warn("Função switchTab não encontrada. Atualize a página.");
        }
        
        // Tenta abrir o chat específico após um delay (tempo para o listener do chat atualizar)
        setTimeout(() => {
            if(window.abrirChat) {
                window.abrirChat(chatRef.id, `Serviço: ${servicoNome}`);
            }
        }, 800);

    } catch (e) {
        console.error("Erro fatal ao criar contrato:", e);
        alert("Não foi possível conectar ao prestador. Tente novamente.");
    }
};


// --- INICIALIZAÇÃO E LISTENERS ---

const toggleBtn = document.getElementById('online-toggle');
if(toggleBtn) {
    toggleBtn.addEventListener('change', (e) => {
        toggleOnlineStatus(e.target.checked);
    });
}

// Monitoramento seguro da aba ativa
setInterval(() => {
    const sec = document.getElementById('sec-servicos');
    // Só carrega se: Aba visível + Usuário é Cliente + Listener nunca rodou
    if(sec && !sec.classList.contains('hidden') && !userProfile.is_provider && !listenerAtivo) {
        carregarPrestadoresOnline();
        listenerAtivo = true;
    }
}, 2000);
