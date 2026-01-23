// 3. CLIENTE: VER PRESTADORES (COM PROTEÇÃO CONTRA FALHA DE CARREGAMENTO)
let unsubscribePrestadores = null; // Variável de controle do listener do Firestore

function carregarPrestadoresOnline() {
    const listaContainer = document.getElementById('lista-prestadores-realtime');
    
    // Se não achou o elemento, tenta de novo em 1s (Recursividade segura)
    if(!listaContainer) {
        setTimeout(carregarPrestadoresOnline, 1000);
        return;
    }

    // Se já existe um listener ativo, cancela ele antes de recriar.
    // Isso é crucial para garantir que o listener esteja vinculado ao elemento HTML atual da tela.
    if (unsubscribePrestadores) {
        unsubscribePrestadores();
        unsubscribePrestadores = null;
    }

    const q = query(collection(db, "active_providers")); 

    unsubscribePrestadores = onSnapshot(q, (snap) => {
        // Redefine a variável aqui caso o elemento tenha sido recriado na troca de abas
        const containerAtual = document.getElementById('lista-prestadores-realtime');
        
        // Se o container não existir mais (usuário saiu da aba), paramos para evitar erro
        if (!containerAtual) return;

        containerAtual.innerHTML = ""; // Limpa visual para receber dados novos
        
        if (snap.empty) {
            containerAtual.innerHTML = `
                <div class="col-span-2 text-center text-gray-400 text-xs py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p class="text-2xl mb-2">🔍</p>
                    <p class="font-bold">Nenhum prestador online.</p>
                    <p class="text-[9px] mt-1 opacity-70">Fique online em outra conta para testar.</p>
                </div>`;
        } else {
            snap.forEach(d => {
                const p = d.data();
                containerAtual.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center relative group hover:shadow-md transition animate-fadeIn">
                        <div class="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <div class="w-12 h-12 bg-blue-50 text-blue-500 rounded-full mb-2 flex items-center justify-center text-xl font-bold border border-blue-100">
                            ${p.email ? p.email.charAt(0).toUpperCase() : '?'}
                        </div>
                        <h4 class="font-bold text-xs text-blue-900 uppercase text-center leading-tight mb-1">${p.profissao || 'Profissional'}</h4>
                        <p class="text-[9px] text-gray-400 mb-3 truncate w-full text-center">${p.email}</p>
                        <button onclick="iniciarContratacao('${p.uid}', '${p.email}')" class="w-full bg-blue-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-700 transition shadow-sm">Chamar</button>
                    </div>`;
            });
        }
    }, (error) => {
        console.error("Erro ao buscar prestadores:", error);
    });
}

window.iniciarContratacao = async (providerId, providerEmail) => {
    if(!auth.currentUser) return alert("Faça login primeiro.");
    if(!confirm(`Deseja iniciar uma conversa com ${providerEmail}?`)) return;
    
    const btn = event.target;
    const textoOriginal = btn.innerText;
    btn.innerText = "Criando sala...";
    btn.disabled = true;

    try {
        const ids = [auth.currentUser.uid, providerId].sort();
        const chatRoomId = `${ids[0]}_${ids[1]}`;
        
        // Verifica se chat já existe
        const chatRef = doc(db, "chats", chatRoomId);
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) {
            await setDoc(chatRef, {
                participants: [auth.currentUser.uid, providerId],
                mission_title: "Negociação de Serviço",
                last_message: "Chat iniciado pelo cliente.",
                updated_at: serverTimestamp(),
                is_service_chat: true
            });
        }

        // Cria notificação de pedido
        await addDoc(collection(db, "orders"), {
            client_id: auth.currentUser.uid,
            client_email: auth.currentUser.email,
            provider_id: providerId,
            provider_email: providerEmail,
            status: "open",
            chat_id: chatRoomId,
            created_at: serverTimestamp()
        });

        // Redireciona
        window.switchTab('chat');
        setTimeout(() => {
            if(window.abrirChat) window.abrirChat(chatRoomId, `Prestador: ${providerEmail}`);
            btn.innerText = textoOriginal;
            btn.disabled = false;
        }, 500);

    } catch (e) {
        alert("Erro ao conectar: " + e.message);
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
};
