import { db, auth } from '../app.js';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// VARIÁVEIS DE CONTEXTO
let targetProviderId = null;
let targetProviderEmail = null;
let orderIdParaAvaliar = null;
let providerIdParaAvaliar = null;
let listenerPrestadoresAtivo = false;
let categoriaAtiva = 'Todos';

// DADOS LOCAIS DO PRESTADOR
let meuPerfilProfissional = null;

// LISTA DE CATEGORIAS
const categoriasDisponiveis = [
    "Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"
];

// INICIALIZAÇÃO
setTimeout(() => {
    configurarBotaoOnline();
    renderizarFiltros(); 
    renderizarCabecalhoUsuario(); 
    carregarPrestadoresOnline(); 
    escutarMeusPedidos(); 
    escutarMeusChamados();
    
    // Inicializa na aba contratar
    if(window.switchServiceSubTab) {
        window.switchServiceSubTab('contratar');
    }
    
    const tabServicos = document.getElementById('tab-servicos');
    if(tabServicos) {
        tabServicos.addEventListener('click', () => {
            carregarPrestadoresOnline();
        });
    }
}, 1000);

// ======================================================
// LÓGICA DE SUB-ABAS E HEADER (NOVO v17.0)
// ======================================================
window.switchServiceSubTab = (tab) => {
    // Esconde todas as views
    ['contratar', 'andamento', 'historico'].forEach(t => {
        const view = document.getElementById(`view-${t}`);
        const btn = document.getElementById(`subtab-${t}-btn`);
        if(view) view.classList.add('hidden');
        if(btn) btn.classList.remove('active');
    });

    // Mostra a selecionada
    const activeView = document.getElementById(`view-${tab}`);
    const activeBtn = document.getElementById(`subtab-${tab}-btn`);
    if(activeView) activeView.classList.remove('hidden');
    if(activeBtn) activeBtn.classList.add('active');
};

function renderizarCabecalhoUsuario() {
    if(!auth.currentUser) return;
    
    const container = document.getElementById('user-header-services');
    if(!container) return;
    
    container.classList.remove('hidden');
    document.getElementById('header-user-name').innerText = auth.currentUser.displayName || "Usuário";
    
    if(auth.currentUser.photoURL) {
        const img = document.getElementById('header-user-pic');
        if(img) img.src = auth.currentUser.photoURL;
    }

    const toggle = document.getElementById('online-toggle');
    if(toggle) { 
        const btnEdit = document.getElementById('btn-edit-profile');
        const secPrestador = document.getElementById('servicos-prestador');
        if(!secPrestador.classList.contains('hidden') && btnEdit) {
             btnEdit.classList.remove('hidden');
        }
    }
}

// ======================================================
// LÓGICA DE FILTROS
// ======================================================
function renderizarFiltros() {
    const container = document.getElementById('category-filters');
    if(!container) return;

    let html = `<button onclick="filtrarCategoria('Todos')" class="filter-pill active px-4 py-2 rounded-full border border-blue-100 bg-white text-blue-900 text-[10px] font-bold uppercase shadow-sm hover:bg-blue-50">Todos</button>`;
    
    categoriasDisponiveis.forEach(cat => {
        html += `<button onclick="filtrarCategoria('${cat}')" class="filter-pill px-4 py-2 rounded-full border border-blue-100 bg-white text-gray-500 text-[10px] font-bold uppercase shadow-sm hover:bg-blue-50">${cat}</button>`;
    });

    container.innerHTML = html;
}

window.filtrarCategoria = (cat) => {
    categoriaAtiva = cat;
    const btns = document.querySelectorAll('.filter-pill');
    btns.forEach(btn => {
        if(btn.innerText.toUpperCase() === cat.toUpperCase()) {
            btn.classList.add('active');
            btn.classList.remove('text-gray-500');
        } else {
            btn.classList.remove('active');
            btn.classList.add('text-gray-500');
        }
    });
    carregarPrestadoresOnline(true); 
};

// ======================================================
// 1. PRESTADOR
// ======================================================
function configurarBotaoOnline() {
    const toggle = document.getElementById('online-toggle');
    if(!toggle) return;
    toggle.checked = false;

    toggle.addEventListener('change', async (e) => {
        const statusMsg = document.getElementById('status-msg');
        
        if (e.target.checked) {
            if (!meuPerfilProfissional) {
                 const userDoc = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
                 const userData = userDoc.data();

                 if (userData.setup_profissional_ok) {
                     meuPerfilProfissional = {
                         nome: userData.nome_profissional,
                         categoria: userData.categoria_profissional,
                         precoBase: userData.preco_base,
                         descricao: userData.descricao_profissional
                     };
                     if(statusMsg) statusMsg.innerHTML = `<p class="text-4xl mb-2 animate-pulse">📡</p><p class="font-bold text-green-500">Buscando Clientes...</p><p class="text-xs text-gray-400">Mantenha o app aberto.</p>`;
                     await ficarOnline();
                 } else {
                    document.getElementById('provider-setup-modal').classList.remove('hidden');
                    const inputNome = document.getElementById('setup-name');
                    if(inputNome && !inputNome.value) inputNome.value = auth.currentUser.displayName || "";
                    e.target.checked = false; 
                 }
            } else {
                if(statusMsg) statusMsg.innerHTML = `<p class="text-4xl mb-2 animate-pulse">📡</p><p class="font-bold text-green-500">Buscando Clientes...</p><p class="text-xs text-gray-400">Mantenha o app aberto.</p>`;
                await ficarOnline();
            }
        } else {
            if(statusMsg) statusMsg.innerHTML = `<p class="text-4xl mb-2">😴</p><p class="font-bold text-gray-400">Você está Offline</p><p class="text-xs">Ative o botão "Trabalhar" no topo.</p>`;
            await ficarOffline();
        }
    });
}

window.salvarSetupPrestador = async () => {
    const nome = document.getElementById('setup-name').value.trim();
    const categoria = document.getElementById('setup-category').value;
    const preco = document.getElementById('setup-price').value;
    const desc = document.getElementById('setup-desc').value.trim();

    if(!nome || !categoria || !preco) return alert("Preencha Nome, Categoria e Preço Base.");

    const btn = event.target;
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        meuPerfilProfissional = {
            nome: nome,
            categoria: categoria,
            precoBase: preco,
            descricao: desc
        };

        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
            setup_profissional_ok: true,
            nome_profissional: nome,
            categoria_profissional: categoria,
            preco_base: preco,
            descricao_profissional: desc
        });

        document.getElementById('provider-setup-modal').classList.add('hidden');
        document.getElementById('online-toggle').checked = true;
        const statusMsg = document.getElementById('status-msg');
        if(statusMsg) statusMsg.innerHTML = `<p class="text-4xl mb-2 animate-pulse">📡</p><p class="font-bold text-green-500">Buscando Clientes...</p><p class="text-xs text-gray-400">Mantenha o app aberto.</p>`;
        
        await ficarOnline();

    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        btn.innerText = "Salvar e Ficar Online";
        btn.disabled = false;
    }
};

async function ficarOnline() {
    if (!auth.currentUser) return;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            await setDoc(doc(db, "active_providers", auth.currentUser.uid), {
                uid: auth.currentUser.uid,
                email: auth.currentUser.email, 
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                tenant_id: 'atlivio_fsa_01', 
                nome_profissional: meuPerfilProfissional.nome,
                categoria: meuPerfilProfissional.categoria,
                preco_base: meuPerfilProfissional.precoBase,
                descricao: meuPerfilProfissional.descricao,
                last_seen: serverTimestamp()
            });
        }, (error) => {
            alert("Erro de GPS: " + error.message);
            document.getElementById('online-toggle').checked = false;
        });
    } else {
        alert("Seu navegador não suporta GPS.");
    }
}

async function ficarOffline() {
    if (!auth.currentUser) return;
    await deleteDoc(doc(db, "active_providers", auth.currentUser.uid));
}

// ======================================================
// 2. CLIENTE (MODO CONTRATAR) - VITRINE
// ======================================================

function carregarPrestadoresOnline(forcar = false) {
    const listaContainer = document.getElementById('lista-prestadores-realtime');
    if(!listaContainer) { setTimeout(carregarPrestadoresOnline, 1000); return; }
    if(listenerPrestadoresAtivo && !forcar) return;
    if(forcar) listaContainer.innerHTML = "";

    const q = query(collection(db, "active_providers")); 

    onSnapshot(q, (snap) => {
        listenerPrestadoresAtivo = true;
        listaContainer.innerHTML = ""; 
        let prestadoresVisiveis = 0;

        if (snap.empty) {
            renderEmptyState(listaContainer);
        } else {
            snap.forEach(d => {
                const p = d.data();
                if(auth.currentUser && p.uid === auth.currentUser.uid) return;
                if (categoriaAtiva !== 'Todos' && p.categoria !== categoriaAtiva) return;
                
                prestadoresVisiveis++;

                const nomeExibicao = p.nome_profissional || "Novo Prestador";
                const categoriaExibicao = p.categoria || "Geral";
                const inicial = nomeExibicao.charAt(0).toUpperCase();
                const precoExibicao = p.preco_base ? `R$ ${p.preco_base}` : "A combinar";

                listaContainer.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center relative group hover:shadow-md transition">
                        <div class="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <div class="w-12 h-12 bg-blue-50 text-blue-500 rounded-full mb-2 flex items-center justify-center text-xl font-bold border border-blue-100">${inicial}</div>
                        <span class="bg-blue-100 text-blue-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase mb-1">${categoriaExibicao}</span>
                        <h4 class="font-bold text-sm text-gray-800 text-center leading-tight mb-1 truncate w-full">${nomeExibicao}</h4>
                        <p class="text-[10px] text-gray-500 mb-3 font-bold">A partir de: ${precoExibicao}</p>
                        <button onclick="abrirModalSolicitacao('${p.uid}', '${nomeExibicao}', '${p.preco_base || 0}')" class="w-full bg-blue-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-700 transition shadow-sm">Solicitar</button>
                    </div>`;
            });

            if(prestadoresVisiveis === 0) renderEmptyState(listaContainer);
        }
    });
}

function renderEmptyState(container) {
    container.innerHTML = `
        <div class="col-span-2 text-center text-gray-400 text-xs py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p class="text-2xl mb-2">🔍</p>
            <p class="font-bold">Nenhum prestador encontrado.</p>
            <p class="text-[9px] mt-1 opacity-70">Tente outra categoria.</p>
        </div>`;
}

// --- FUNÇÃO ATUALIZADA: DISTRIBUI NOS CONTAINERS CERTOS ---
function escutarMeusPedidos() {
    if(!auth.currentUser) return;
    
    // Containers
    const containerAndamento = document.getElementById('meus-pedidos-andamento');
    const containerHistorico = document.getElementById('meus-pedidos-historico');
    
    if(!containerAndamento || !containerHistorico) return;

    const q = query(collection(db, "orders"), where("client_id", "==", auth.currentUser.uid));

    onSnapshot(q, (snap) => {
        // Limpa
        containerAndamento.innerHTML = "";
        containerHistorico.innerHTML = "";
        
        let hasAndamento = false;
        let hasHistorico = false;

        if(!snap.empty) {
            snap.forEach(d => {
                const pedido = d.data();
                const nomePrestadorHistorico = pedido.provider_email || "Prestador"; 
                
                // === PEDIDOS ATIVOS (EM ANDAMENTO) ===
                if (pedido.status === 'pending_acceptance' || pedido.status === 'reserved') {
                    hasAndamento = true;
                    let badge = pedido.status === 'pending_acceptance' 
                        ? `<span class="text-[9px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">AGUARDANDO ACEITE</span>`
                        : `<span class="text-[9px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-bold">EM ANDAMENTO</span>`;
                    
                    let actions = "";
                    if(pedido.status === 'reserved') {
                        actions = `
                        <div class="flex gap-2">
                            <button onclick="aceitarChamado('${d.id}', '${pedido.chat_id}', '${nomePrestadorHistorico}')" class="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-bold text-[10px] uppercase">Chat</button>
                            <button onclick="gerarTokenCliente('${d.id}')" class="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase shadow-sm">${pedido.finalization_code ? 'VER CÓDIGO 🔑' : 'FINALIZAR SERVIÇO ✅'}</button>
                        </div>`;
                    } else {
                        actions = `<p class="text-[9px] text-gray-400 italic">O prestador precisa aceitar para liberar o chat.</p>`;
                    }

                    containerAndamento.innerHTML += `
                        <div class="bg-white p-4 rounded-xl border-l-4 ${pedido.status === 'reserved' ? 'border-yellow-400' : 'border-gray-300'} shadow-sm mb-2">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-[10px] font-bold uppercase text-gray-500">Prestador: ${nomePrestadorHistorico}</span>
                                ${badge}
                            </div>
                            <h4 class="font-black text-gray-800 text-sm mb-3">R$ ${pedido.service_value}</h4>
                            ${actions}
                        </div>`;
                } 
                // === PEDIDOS FINALIZADOS/RECUSADOS (HISTÓRICO) ===
                else if (pedido.status === 'completed' || pedido.status === 'rejected') {
                    hasHistorico = true;
                    let badge = pedido.status === 'completed' 
                        ? `<span class="text-[9px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold">CONCLUÍDO</span>`
                        : `<span class="text-[9px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold">RECUSADO</span>`;
                    
                    let reviewBtn = (pedido.status === 'completed' && !pedido.is_reviewed) 
                        ? `<button onclick="abrirModalAvaliacao('${d.id}', '${pedido.provider_id}')" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-xs uppercase animate-pulse mt-2">⭐ AVALIAR PRESTADOR</button>`
                        : '';

                    containerHistorico.innerHTML += `
                        <div class="bg-white p-4 rounded-xl border-l-4 ${pedido.status === 'completed' ? 'border-green-500' : 'border-red-500'} shadow-sm mb-2">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-[10px] font-bold uppercase text-gray-500">Prestador: ${nomePrestadorHistorico}</span>
                                ${badge}
                            </div>
                            ${reviewBtn}
                        </div>`;
                }
            });
        }

        // Empty States
        if(!hasAndamento) containerAndamento.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Nenhum serviço em andamento.</p>`;
        if(!hasHistorico) containerHistorico.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Histórico vazio.</p>`;
    });
}

function escutarMeusChamados() {
    if(!auth.currentUser) return;
    const container = document.getElementById('lista-chamados');
    if(!container) { setTimeout(escutarMeusChamados, 1000); return; }
    const q = query(collection(db, "orders"), where("provider_id", "==", auth.currentUser.uid));

    onSnapshot(q, (snap) => {
        const lista = document.getElementById('lista-chamados');
        lista.innerHTML = "";
        if (snap.empty) { lista.classList.add('hidden'); } else {
            lista.classList.remove('hidden');
            lista.innerHTML = `<h3 class="font-black text-blue-900 text-xs uppercase mb-2">🔔 Gerenciador de Pedidos</h3>`;
            snap.forEach(d => {
                const pedido = d.data();
                if (pedido.status === 'pending_acceptance') {
                    lista.innerHTML += `
                    <div class="bg-yellow-50 p-4 rounded-xl border-l-4 border-yellow-500 shadow-md mb-4 animate-fadeIn">
                        <div class="mb-2"><p class="font-bold text-sm text-yellow-900">NOVA PROPOSTA! 📩</p><p class="text-[10px] text-yellow-800">Cliente: ${pedido.client_email}</p><p class="text-[10px] text-yellow-800 font-bold mt-1">Oferta: R$ ${pedido.service_value} <span class="font-normal">(Reserva já paga)</span></p></div>
                        <div class="flex gap-2"><button onclick="recusarPedido('${d.id}')" class="flex-1 bg-red-100 text-red-700 py-2 rounded-lg font-bold text-[10px] uppercase">Recusar</button><button onclick="aceitarPedido('${d.id}')" class="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase shadow-sm">ACEITAR ✅</button></div>
                    </div>`;
                }
                else if (pedido.status === 'reserved') {
                    lista.innerHTML += `
                    <div class="bg-green-50 p-4 rounded-xl border-l-4 border-green-600 shadow-md mb-4 animate-fadeIn">
                        <div class="flex justify-between items-start mb-2"><div><p class="font-bold text-sm text-green-900">SERVIÇO ATIVO 🚀</p><p class="text-[10px] text-green-700">Cliente: ${pedido.client_email}</p></div><span class="text-xl">🔒</span></div>
                        <div class="grid grid-cols-2 gap-2 mb-3"><button onclick="aceitarChamado('${d.id}', '${pedido.chat_id}', '${pedido.client_email}')" class="bg-blue-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase shadow-sm">💬 Abrir Chat</button><div class="text-center"><p class="text-[8px] text-gray-500 uppercase font-bold">Restante a receber:</p><p class="font-black text-gray-800">R$ ${(pedido.service_value - pedido.amount_total_reservation).toFixed(2)}</p></div></div>
                        <div class="bg-white p-3 rounded-lg border border-green-200"><label class="text-[9px] font-bold text-gray-500 uppercase block mb-1">Finalizar Serviço (Peça o código)</label><div class="flex gap-2"><input type="tel" id="token-${d.id}" placeholder="0000" maxlength="4" class="w-16 text-center font-black text-lg border-2 border-gray-200 rounded-lg focus:border-green-500 outline-none text-gray-800"><button onclick="validarTokenPrestador('${d.id}', ${pedido.service_value})" class="flex-1 bg-green-600 text-white font-bold text-xs rounded-lg hover:bg-green-700 transition">VALIDAR & RECEBER</button></div></div>
                    </div>`;
                }
                else if (pedido.status === 'completed') {
                    lista.innerHTML += `<div class="bg-gray-100 p-3 rounded-xl border border-gray-200 opacity-70 mb-2"><p class="font-bold text-xs text-gray-600">✅ Serviço Finalizado</p><p class="text-[10px] text-gray-400">${pedido.service_date} - ${pedido.client_email}</p></div>`;
                }
            });
        }
    });
}

// ======================================================
// FUNÇÕES GLOBAIS DE AÇÃO (EXPANDIDAS E LIMPAS)
// ======================================================

window.aceitarPedido = async (orderId) => { 
    if(!confirm("Aceitar proposta e iniciar serviço?")) return; 
    try { 
        const orderRef = doc(db, "orders", orderId); 
        const orderSnap = await getDoc(orderRef); 
        const pedido = orderSnap.data(); 
        
        await updateDoc(orderRef, { status: "reserved" }); 
        
        const chatRef = doc(db, "chats", pedido.chat_id); 
        await setDoc(chatRef, { 
            participants: [pedido.client_id, pedido.provider_id], 
            mission_title: `Serviço: R$ ${pedido.service_value} (Em Andamento)`, 
            last_message: "Proposta aceita! O chat está liberado.", 
            updated_at: serverTimestamp(), 
            is_service_chat: true 
        }); 
        alert("✅ Serviço Aceito! O chat foi liberado."); 
    } catch(e) { 
        alert("Erro: " + e.message); 
    } 
};

window.recusarPedido = async (orderId) => { 
    if(!confirm("Recusar proposta?")) return; 
    try { 
        await updateDoc(doc(db, "orders", orderId), { status: "rejected" }); 
        alert("❌ Proposta recusada."); 
    } catch(e) { 
        alert("Erro: " + e.message); 
    } 
};

window.validarTokenPrestador = async (orderId, valorTotal) => { 
    const input = document.getElementById(`token-${orderId}`); 
    const tokenDigitado = input.value.trim(); 
    if(tokenDigitado.length !== 4) return alert("O código deve ter 4 dígitos."); 
    
    const btn = event.target; 
    btn.innerText = "Verificando..."; 
    btn.disabled = true; 
    
    try { 
        const orderRef = doc(db, "orders", orderId); 
        const orderSnap = await getDoc(orderRef); 
        
        if(!orderSnap.exists()) throw new Error("Pedido não encontrado."); 
        
        if (tokenDigitado === orderSnap.data().finalization_code) { 
            await updateDoc(orderRef, { status: 'completed', completed_at: serverTimestamp() }); 
            await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { saldo: increment(orderSnap.data().amount_security || 0) }); 
            alert(`✅ SUCESSO!\n\nCódigo Validado Corretamente.\nServiço Encerrado.`); 
        } else { 
            alert("❌ CÓDIGO INVÁLIDO."); 
            input.value = ""; 
            btn.innerText = "VALIDAR & RECEBER"; 
            btn.disabled = false; 
        } 
    } catch (e) { 
        alert("Erro: " + e.message); 
        btn.innerText = "Erro"; 
        btn.disabled = false; 
    } 
};

window.aceitarChamado = (orderId, chatId, clientName) => { 
    window.switchTab('chat'); 
    setTimeout(() => { 
        if(window.abrirChat) window.abrirChat(chatId, `Negociação com ${clientName}`); 
    }, 500); 
};

window.abrirModalAvaliacao = (orderId, providerId) => { 
    orderIdParaAvaliar = orderId; 
    providerIdParaAvaliar = providerId; 
    document.getElementById('review-modal').classList.remove('hidden'); 
};

window.enviarAvaliacao = async () => { 
    let stars = 0; 
    document.querySelectorAll('.rate-star.active').forEach(s => stars = Math.max(stars, s.getAttribute('data-val'))); 
    if(stars === 0) return alert("Selecione pelo menos 1 estrela."); 
    
    const comment = document.getElementById('review-comment').value.trim(); 
    const tags = []; 
    document.querySelectorAll('.tag-select.selected').forEach(t => tags.push(t.innerText)); 
    const recommend = document.querySelector('input[name="recommend"]:checked').value === 'yes'; 
    
    const btn = event.target; 
    btn.innerText = "Enviando..."; 
    btn.disabled = true; 
    
    try { 
        await addDoc(collection(db, "reviews"), { 
            order_id: orderIdParaAvaliar, 
            provider_id: providerIdParaAvaliar, 
            client_id: auth.currentUser.uid, 
            stars: parseInt(stars), 
            tags: tags, 
            comment: comment, 
            recommended: recommend, 
            created_at: serverTimestamp() 
        }); 
        
        await updateDoc(doc(db, "orders", orderIdParaAvaliar), { is_reviewed: true }); 
        document.getElementById('review-modal').classList.add('hidden'); 
        alert("✅ Avaliação Enviada!"); 
    } catch (e) { 
        alert("Erro: " + e.message); 
        btn.innerText = "Tentar Novamente"; 
        btn.disabled = false; 
    } 
};

window.gerarTokenCliente = async (orderId) => { 
    const btn = event.target; 
    btn.disabled = true; 
    try { 
        const orderRef = doc(db, "orders", orderId); 
        const docSnap = await getDoc(orderRef); 
        let code = docSnap.data().finalization_code; 
        
        if (!code) { 
            code = Math.floor(1000 + Math.random() * 9000).toString(); 
            await updateDoc(orderRef, { finalization_code: code }); 
        } 
        
        alert(`🔑 CÓDIGO DE FINALIZAÇÃO: ${code}\n\nINSTRUÇÃO:\nSó passe este código ao prestador quando o serviço estiver 100% concluído.\nAssim que ele validar, o serviço encerra.`); 
        btn.innerText = "VER CÓDIGO 🔑"; 
        btn.disabled = false; 
    } catch (e) { 
        alert("Erro: " + e.message); 
        btn.disabled = false; 
    } 
};

window.abrirModalSolicitacao = (uid, nomePrestador, precoBase) => { 
    if(!auth.currentUser) return alert("Faça login."); 
    targetProviderId = uid; 
    targetProviderEmail = nomePrestador; 
    
    if(window.togglePriceInput) { 
        document.getElementById('label-base-price').innerText = `Aceitar valor (R$ ${precoBase})`; 
        document.getElementById('price-option-base').checked = false; 
        document.getElementById('price-option-custom').checked = false; 
        document.getElementById('custom-price-container').classList.add('hidden'); 
        document.getElementById('financial-summary').classList.add('hidden'); 
        document.getElementById('btn-confirm-req').disabled = true; 
        document.getElementById('btn-confirm-req').classList.add('opacity-50'); 
        
        window.basePriceAtual = parseFloat(precoBase); 
    } 
    document.getElementById('request-modal').classList.remove('hidden'); 
};

window.confirmarSolicitacao = async () => { 
    const data = document.getElementById('req-date').value; 
    const hora = document.getElementById('req-time').value; 
    const local = document.getElementById('req-local').value; 
    
    let valor = 0; 
    if (document.getElementById('price-option-base').checked) { 
        valor = window.basePriceAtual; 
    } else { 
        valor = parseFloat(document.getElementById('req-value').value); 
    } 
    
    if(!data || !hora || !local || !valor) return alert("Preencha tudo e selecione um valor!"); 
    
    const btn = document.getElementById('btn-confirm-req'); 
    btn.innerText = "Enviando Proposta..."; 
    btn.disabled = true; 
    
    try { 
        const seguranca = valor * 0.30; 
        const taxa = valor * 0.10; 
        const reservaTotal = seguranca + taxa; 
        
        const ids = [auth.currentUser.uid, targetProviderId].sort(); 
        const chatRoomId = `${ids[0]}_${ids[1]}`; 
        
        await addDoc(collection(db, "orders"), { 
            client_id: auth.currentUser.uid, 
            client_email: auth.currentUser.email, 
            provider_id: targetProviderId, 
            provider_email: targetProviderEmail, 
            service_date: data, 
            service_time: hora, 
            service_location: local, 
            service_value: valor, 
            amount_total_reservation: reservaTotal, 
            amount_security: seguranca, 
            amount_fee: taxa, 
            status: "pending_acceptance", 
            chat_id: chatRoomId, 
            created_at: serverTimestamp() 
        }); 
        
        document.getElementById('request-modal').classList.add('hidden'); 
        alert(`✅ Proposta Enviada!\n\nReserva Paga (Simulado): R$ ${reservaTotal.toFixed(2)}\nAguarde o aceite do prestador.`); 
        
        btn.innerText = "PAGAR E ENVIAR 🔒"; 
        btn.disabled = false; 
    } catch (e) { 
        console.error(e); 
        alert("Erro técnico: " + e.message); 
        btn.innerText = "Tentar Novamente"; 
        btn.disabled = false; 
    } 
};
