import { db, auth } from '../app.js';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// VARIÁVEIS
let targetProviderEmail = null;
let orderIdParaAvaliar = null;
let providerIdParaAvaliar = null;
let listenerPrestadoresAtivo = false;
let categoriaAtiva = 'Todos';
let meuPerfilProfissional = null;
let meusServicos = [];

const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];

// INICIALIZAÇÃO SEGURA (ESPERA AUTH)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 1. Configura UI
        configurarBotaoOnline();
        renderizarFiltros(); 
        renderizarCabecalhoUsuario(); 
        
        // 2. Inicia Listeners
        carregarPrestadoresOnline(); 
        escutarMeusPedidos(); 
        escutarMeusChamados();
        
        // 3. RECUPERA ESTADO ONLINE (A MÁGICA DO F5)
        await verificarStatusOnline(user.uid);

        // 4. Tabs
        if(window.switchServiceSubTab) window.switchServiceSubTab('contratar');
        if(window.switchProviderSubTab) window.switchProviderSubTab('radar');
        const tabServicos = document.getElementById('tab-servicos');
        if(tabServicos) { tabServicos.addEventListener('click', () => { carregarPrestadoresOnline(); }); }
    }
});

// --- PERSISTÊNCIA: MEMÓRIA DO BOTÃO ---
async function verificarStatusOnline(uid) {
    try {
        const docRef = doc(db, "active_providers", uid);
        const docSnap = await getDoc(docRef);
        const toggle = document.getElementById('online-toggle');
        
        if (docSnap.exists()) {
            console.log("✅ Você já estava online. Religando botão...");
            if(toggle) {
                toggle.checked = true;
                // Recupera serviços locais para não bugar o perfil
                meusServicos = docSnap.data().services || [];
                // Reativa o GPS silenciosamente
                ficarOnline(); 
            }
        }
    } catch (e) {
        console.log("Erro ao verificar status online:", e);
    }
}

// --- LÓGICA DE ABAS ---
window.switchServiceSubTab = (tab) => { ['contratar', 'andamento', 'historico'].forEach(t => { const view = document.getElementById(`view-${t}`); const btn = document.getElementById(`subtab-${t}-btn`); if(view) view.classList.add('hidden'); if(btn) btn.classList.remove('active'); }); const activeView = document.getElementById(`view-${tab}`); const activeBtn = document.getElementById(`subtab-${tab}-btn`); if(activeView) activeView.classList.remove('hidden'); if(activeBtn) activeBtn.classList.add('active'); };
window.switchProviderSubTab = (tabName) => { const views = ['radar', 'ativos', 'historico']; views.forEach(t => { const viewEl = document.getElementById(`pview-${t}`); const btnEl = document.getElementById(`ptab-${t}-btn`); if(viewEl) viewEl.classList.add('hidden'); if(btnEl) btnEl.classList.remove('active'); }); const targetView = document.getElementById(`pview-${tabName}`); const targetBtn = document.getElementById(`ptab-${tabName}-btn`); if(targetView) targetView.classList.remove('hidden'); if(targetBtn) targetBtn.classList.add('active'); };

// --- GESTÃO DE SERVIÇOS ---
window.addServiceLocal = () => { const cat = document.getElementById('new-service-category').value; const price = document.getElementById('new-service-price').value; const desc = document.getElementById('new-service-desc').value.trim(); if(!cat || cat === "" || !price) return alert("Preencha categoria e preço."); meusServicos.push({ category: cat, price: parseFloat(price), description: desc || `Serviço de ${cat}` }); document.getElementById('new-service-category').value = ""; document.getElementById('new-service-price').value = ""; document.getElementById('new-service-desc').value = ""; renderMyServicesList(); };
function renderMyServicesList() { const list = document.getElementById('my-services-list'); if(!list) return; if(meusServicos.length === 0) { list.innerHTML = `<p class="text-center text-gray-300 text-xs italic py-4">Nenhum serviço adicionado.</p>`; return; } list.innerHTML = ""; meusServicos.forEach((srv, index) => { list.innerHTML += `<div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center animate-fadeIn"><div><span class="block font-bold text-xs text-blue-900">${srv.category}</span><span class="text-[10px] text-gray-500">R$ ${srv.price.toFixed(2)} - ${srv.description.substring(0, 20)}...</span></div><button onclick="removeServiceLocal(${index})" class="text-red-400 font-bold text-lg hover:text-red-600">&times;</button></div>`; }); }
window.removeServiceLocal = (index) => { meusServicos.splice(index, 1); renderMyServicesList(); };
window.saveServicesAndGoOnline = async () => { if(meusServicos.length === 0) return alert("Adicione pelo menos 1 serviço."); const btn = event.target; btn.innerText = "Salvando..."; btn.disabled = true; try { const nome = document.getElementById('setup-name').value.trim(); if(!nome) throw new Error("Preencha seu Nome Profissional."); await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { setup_profissional_ok: true, nome_profissional: nome, services_offered: meusServicos }); document.getElementById('provider-setup-modal').classList.add('hidden'); document.getElementById('online-toggle').checked = true; await ficarOnline(); } catch (e) { alert("Erro: " + e.message); document.getElementById('online-toggle').checked = false; } finally { btn.innerText = "Salvar e Ficar Online 📡"; btn.disabled = false; } };

// --- ONLINE/OFFLINE ---
function configurarBotaoOnline() { 
    const toggle = document.getElementById('online-toggle'); 
    if(!toggle) return; 
    
    // Removemos o toggle.checked = false daqui para não resetar no F5
    
    toggle.addEventListener('change', async (e) => { 
        if (e.target.checked) { 
            const userDoc = await getDoc(doc(db, "usuarios", auth.currentUser.uid)); 
            const userData = userDoc.data(); 
            if (userData.setup_profissional_ok && userData.services_offered && userData.services_offered.length > 0) { 
                meusServicos = userData.services_offered; 
                document.getElementById('setup-name').value = userData.nome_profissional || ""; 
                renderMyServicesList(); 
                await ficarOnline(); 
            } else { 
                document.getElementById('provider-setup-modal').classList.remove('hidden'); 
                e.target.checked = false; 
            } 
        } else { 
            await ficarOffline(); 
        } 
    }); 
}
async function ficarOnline() { if (!auth.currentUser) return; if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(async (position) => { const userDoc = await getDoc(doc(db, "usuarios", auth.currentUser.uid)); const userData = userDoc.data(); const categoriasAtivas = meusServicos.map(s => s.category); await setDoc(doc(db, "active_providers", auth.currentUser.uid), { uid: auth.currentUser.uid, email: auth.currentUser.email, lat: position.coords.latitude, lng: position.coords.longitude, tenant_id: 'atlivio_fsa_01', nome_profissional: userData.nome_profissional, foto_perfil: auth.currentUser.photoURL || null, services: meusServicos, categories: categoriasAtivas, last_seen: serverTimestamp() }); }, (error) => { console.log("GPS Error ignored on reload"); }); } } // Removido alert de erro para não chatear no F5
async function ficarOffline() { if (!auth.currentUser) return; await deleteDoc(doc(db, "active_providers", auth.currentUser.uid)); }

// --- ESCUTA DE PEDIDOS (RADAR) ---
function escutarMeusChamados() {
    if(!auth.currentUser) return;
    const containerRadar = document.getElementById('pview-radar');
    const containerAtivos = document.getElementById('lista-chamados-ativos');
    const containerHistorico = document.getElementById('lista-chamados-historico');
    if(!containerAtivos || !containerHistorico) return; // Removido setTimeout recursivo perigoso
    
    const q = query(collection(db, "orders"), where("provider_id", "==", auth.currentUser.uid));
    
    onSnapshot(q, (snap) => {
        containerAtivos.innerHTML = ""; containerHistorico.innerHTML = ""; let pedidoPendente = null; let hasAtivos = false; let hasHistorico = false;
        
        if(!snap.empty) {
            snap.forEach(d => {
                const pedido = d.data();
                if (pedido.status === 'pending_acceptance') { pedidoPendente = { id: d.id, ...pedido }; }
                else if (pedido.status === 'reserved') { hasAtivos = true; containerAtivos.innerHTML += `<div class="bg-green-50 p-4 rounded-xl border-l-4 border-green-600 shadow-md mb-4 animate-fadeIn"><div class="flex justify-between items-start mb-2"><div><p class="font-bold text-sm text-green-900">EM EXECUÇÃO 🚀</p><p class="text-[10px] text-green-700">Cliente: ${pedido.client_email}</p></div><span class="text-xl">🔒</span></div><div class="grid grid-cols-2 gap-2 mb-3"><button onclick="aceitarChamado('${d.id}', '${pedido.chat_id}', '${pedido.client_email}')" class="bg-blue-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase shadow-sm">💬 Abrir Chat</button><div class="text-center"><p class="text-[8px] text-gray-500 uppercase font-bold">A Receber:</p><p class="font-black text-gray-800">R$ ${(pedido.service_value - pedido.amount_total_reservation).toFixed(2)}</p></div></div><div class="bg-white p-3 rounded-lg border border-green-200"><label class="text-[9px] font-bold text-gray-500 uppercase block mb-1">Finalizar (Peça o código)</label><div class="flex gap-2"><input type="tel" id="token-${d.id}" placeholder="0000" maxlength="4" class="w-16 text-center font-black text-lg border-2 border-gray-200 rounded-lg focus:border-green-500 outline-none text-gray-800"><button onclick="validarTokenPrestador('${d.id}', ${pedido.service_value})" class="flex-1 bg-green-600 text-white font-bold text-xs rounded-lg hover:bg-green-700 transition">VALIDAR</button></div></div></div>`; } 
                else if (pedido.status === 'completed' || pedido.status === 'rejected') { hasHistorico = true; containerHistorico.innerHTML += `<div class="bg-gray-100 p-3 rounded-xl border border-gray-200 opacity-70 mb-2"><p class="font-bold text-xs text-gray-600">${pedido.status === 'completed' ? '✅ Finalizado' : '❌ Recusado'}</p><p class="text-[10px] text-gray-400">${pedido.service_date} - ${pedido.client_email}</p></div>`; }
            });
        }
        
        const toggle = document.getElementById('online-toggle');
        // Checagem visual apenas se o toggle existe e está checked
        const isOnline = toggle && toggle.checked;
        
        if (pedidoPendente) {
            if(window.switchProviderSubTab) window.switchProviderSubTab('radar'); 
            containerRadar.innerHTML = `<div class="bg-white border-4 border-yellow-400 p-6 rounded-2xl shadow-2xl animate-pulse"><div class="text-4xl mb-4">🔔</div><h2 class="text-2xl font-black text-blue-900 uppercase mb-2">NOVA SOLICITAÇÃO!</h2><p class="text-gray-500 text-sm mb-4">Cliente: ${pedidoPendente.client_email}</p><div class="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-6"><p class="text-xs font-bold text-gray-400 uppercase">Oferta:</p><p class="text-3xl font-black text-green-600">R$ ${pedidoPendente.service_value}</p><p class="text-[10px] text-gray-400 mt-1">Reserva de 40% já garantida.</p></div><div class="grid grid-cols-2 gap-3"><button onclick="recusarPedido('${pedidoPendente.id}')" class="bg-red-100 text-red-600 py-4 rounded-xl font-black uppercase hover:bg-red-200">RECUSAR ✖</button><button onclick="aceitarPedido('${pedidoPendente.id}')" class="bg-green-600 text-white py-4 rounded-xl font-black uppercase shadow-lg hover:bg-green-700 transform hover:scale-105 transition">ACEITAR ✅</button></div></div>`;
            const audio = document.getElementById('notification-sound'); if(audio) audio.play().catch(()=>{});
        } else {
            if (isOnline) { containerRadar.innerHTML = `<div id="status-msg" class="text-gray-400 mb-4 py-10"><p class="text-6xl mb-4 animate-pulse">📡</p><p class="font-bold text-lg text-green-500">Buscando Clientes...</p><p class="text-xs text-gray-400 mt-2">Mantenha o app aberto.</p></div>`; } 
            else { containerRadar.innerHTML = `<div id="status-msg" class="text-gray-400 mb-4 py-10"><p class="text-6xl mb-4">😴</p><p class="font-bold text-lg">Você está Offline</p><p class="text-xs mt-2">Ative o botão "Trabalhar" no topo.</p></div>`; }
        }
        
        if(!hasAtivos) containerAtivos.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Nenhum pedido em execução.</p>`;
        if(!hasHistorico) containerHistorico.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Histórico vazio.</p>`;
    }, (error) => { console.error("Erro no listener:", error); });
}

// --- UTILS ---
function renderizarCabecalhoUsuario() { if(!auth.currentUser) return; const container = document.getElementById('user-header-services'); if(container) { container.classList.remove('hidden'); document.getElementById('header-user-name').innerText = auth.currentUser.displayName || "Usuário"; if(auth.currentUser.photoURL) { const img = document.getElementById('header-user-pic'); if(img) img.src = auth.currentUser.photoURL; } } const providerPic = document.getElementById('provider-header-pic'); const providerName = document.getElementById('provider-header-name'); if(providerPic && auth.currentUser.photoURL) providerPic.src = auth.currentUser.photoURL; if(providerName) providerName.innerText = auth.currentUser.displayName || "Prestador"; const toggle = document.getElementById('online-toggle'); if(toggle) { const btnEdit = document.getElementById('btn-edit-profile'); const secPrestador = document.getElementById('servicos-prestador'); if(!secPrestador.classList.contains('hidden') && btnEdit) btnEdit.classList.remove('hidden'); } }
function renderizarFiltros() { const container = document.getElementById('category-filters'); if(!container) return; let html = `<button onclick="filtrarCategoria('Todos')" class="filter-pill active px-4 py-2 rounded-full border border-blue-100 bg-white text-blue-900 text-[10px] font-bold uppercase shadow-sm hover:bg-blue-50">Todos</button>`; categoriasDisponiveis.forEach(cat => { html += `<button onclick="filtrarCategoria('${cat}')" class="filter-pill px-4 py-2 rounded-full border border-blue-100 bg-white text-gray-500 text-[10px] font-bold uppercase shadow-sm hover:bg-blue-50">${cat}</button>`; }); container.innerHTML = html; }
window.filtrarCategoria = (cat) => { categoriaAtiva = cat; const btns = document.querySelectorAll('.filter-pill'); btns.forEach(btn => { if(btn.innerText.toUpperCase() === cat.toUpperCase()) { btn.classList.add('active'); btn.classList.remove('text-gray-500'); } else { btn.classList.remove('active'); btn.classList.add('text-gray-500'); } }); carregarPrestadoresOnline(true); };

function carregarPrestadoresOnline(forcar = false) { 
    const listaContainer = document.getElementById('lista-prestadores-realtime'); 
    if(!listaContainer) return; // Sem loop perigoso
    if(listenerPrestadoresAtivo && !forcar) return; 
    
    // EVITA O PISCA-PISCA: Não limpa se já tiver coisa, a menos que seja forçado
    if(forcar) listaContainer.innerHTML = ""; 
    
    let q = query(collection(db, "active_providers")); 
    if (categoriaAtiva !== 'Todos') { q = query(collection(db, "active_providers"), where("categories", "array-contains", categoriaAtiva)); } 
    onSnapshot(q, (snap) => { 
        listenerPrestadoresAtivo = true; 
        listaContainer.innerHTML = ""; // Limpa só quando O DADO CHEGOU
        if (snap.empty) { renderEmptyState(listaContainer); } 
        else { 
            snap.forEach(d => { 
                const p = d.data(); 
                if(auth.currentUser && p.uid === auth.currentUser.uid) return; 
                if (!p.services || p.services.length === 0) return; 
                let servicoExibido = null; 
                if (categoriaAtiva !== 'Todos') { servicoExibido = p.services.find(s => s.category === categoriaAtiva); } 
                else { servicoExibido = p.services[0]; } 
                if(!servicoExibido) return; 
                const nomeExibicao = p.nome_profissional || "Prestador"; 
                const fotoUrl = p.foto_perfil; 
                const avatarContent = fotoUrl ? `<img src="${fotoUrl}" class="w-full h-full object-cover rounded-full">` : `<div class="w-full h-full bg-blue-50 text-blue-500 flex items-center justify-center text-xl font-bold rounded-full">${nomeExibicao.charAt(0)}</div>`; 
                listaContainer.innerHTML += `<div class="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center relative group hover:shadow-md transition cursor-pointer" onclick="abrirPerfilPublico('${p.uid}')"><div class="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div><div class="w-12 h-12 mb-2 border border-blue-100 rounded-full">${avatarContent}</div><span class="bg-blue-100 text-blue-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase mb-1">${servicoExibido.category}</span><h4 class="font-bold text-sm text-gray-800 text-center leading-tight mb-1 truncate w-full">${nomeExibicao}</h4><p class="text-[10px] text-gray-500 mb-3 font-bold">A partir de: R$ ${servicoExibido.price}</p><button onclick="event.stopPropagation(); abrirModalSolicitacao('${p.uid}', '${nomeExibicao}', '${servicoExibido.price}')" class="w-full bg-blue-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-700 transition shadow-sm">Solicitar</button></div>`; 
            }); 
        } 
    }); 
}

window.abrirPerfilPublico = async (uid) => { const modal = document.getElementById('provider-profile-modal'); const listaServicos = document.getElementById('public-services-list'); modal.classList.remove('hidden'); listaServicos.innerHTML = '<p class="text-center text-xs">Carregando...</p>'; try { const docSnap = await getDoc(doc(db, "active_providers", uid)); if(!docSnap.exists()) return; const p = docSnap.data(); document.getElementById('public-profile-name').innerText = p.nome_profissional; if(p.foto_perfil) document.getElementById('public-profile-photo').src = p.foto_perfil; listaServicos.innerHTML = ""; p.services.forEach(s => { listaServicos.innerHTML += `<div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center"><div class="flex-1"><span class="block font-bold text-xs text-blue-900 uppercase">${s.category}</span><span class="text-[10px] text-gray-500 block leading-tight">${s.description}</span></div><div class="text-right ml-2"><span class="block font-black text-sm text-gray-800">R$ ${s.price}</span><button onclick="document.getElementById('provider-profile-modal').classList.add('hidden'); abrirModalSolicitacao('${p.uid}', '${p.nome_profissional}', '${s.price}')" class="text-[9px] text-blue-600 font-bold border border-blue-200 px-2 py-1 rounded mt-1 hover:bg-blue-50">Contratar</button></div></div>`; }); } catch (e) { console.error(e); listaServicos.innerHTML = '<p class="text-red-500 text-xs">Erro ao carregar perfil.</p>'; } };
function renderEmptyState(container) { container.innerHTML = `<div class="col-span-2 text-center text-gray-400 text-xs py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200"><p class="text-2xl mb-2">🔍</p><p class="font-bold">Nenhum prestador encontrado.</p><p class="text-[9px] mt-1 opacity-70">Tente outra categoria.</p></div>`; }
function escutarMeusPedidos() { if(!auth.currentUser) return; const containerAndamento = document.getElementById('meus-pedidos-andamento'); const containerHistorico = document.getElementById('meus-pedidos-historico'); if(!containerAndamento || !containerHistorico) return; const q = query(collection(db, "orders"), where("client_id", "==", auth.currentUser.uid)); onSnapshot(q, (snap) => { containerAndamento.innerHTML = ""; containerHistorico.innerHTML = ""; let hasAndamento = false; let hasHistorico = false; if(!snap.empty) { snap.forEach(d => { const pedido = d.data(); const nomePrestadorHistorico = pedido.provider_email || "Prestador"; if (pedido.status === 'pending_acceptance' || pedido.status === 'reserved') { hasAndamento = true; let badge = pedido.status === 'pending_acceptance' ? `<span class="text-[9px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">AGUARDANDO ACEITE</span>` : `<span class="text-[9px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-bold">EM ANDAMENTO</span>`; let actions = pedido.status === 'reserved' ? `<div class="flex gap-2"><button onclick="aceitarChamado('${d.id}', '${pedido.chat_id}', '${nomePrestadorHistorico}')" class="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-bold text-[10px] uppercase">Chat</button><button onclick="gerarTokenCliente('${d.id}')" class="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase shadow-sm">${pedido.finalization_code ? 'VER CÓDIGO 🔑' : 'FINALIZAR SERVIÇO ✅'}</button></div>` : `<p class="text-[9px] text-gray-400 italic">O prestador precisa aceitar para liberar o chat.</p>`; containerAndamento.innerHTML += `<div class="bg-white p-4 rounded-xl border-l-4 ${pedido.status === 'reserved' ? 'border-yellow-400' : 'border-gray-300'} shadow-sm mb-2"><div class="flex justify-between items-center mb-2"><span class="text-[10px] font-bold uppercase text-gray-500">Prestador: ${nomePrestadorHistorico}</span>${badge}</div><h4 class="font-black text-gray-800 text-sm mb-3">R$ ${pedido.service_value}</h4>${actions}</div>`; } else if (pedido.status === 'completed' || pedido.status === 'rejected') { hasHistorico = true; let badge = pedido.status === 'completed' ? `<span class="text-[9px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold">CONCLUÍDO</span>` : `<span class="text-[9px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold">RECUSADO</span>`; let reviewBtn = (pedido.status === 'completed' && !pedido.is_reviewed) ? `<button onclick="abrirModalAvaliacao('${d.id}', '${pedido.provider_id}')" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-xs uppercase animate-pulse mt-2">⭐ AVALIAR PRESTADOR</button>` : ''; containerHistorico.innerHTML += `<div class="bg-white p-4 rounded-xl border-l-4 ${pedido.status === 'completed' ? 'border-green-500' : 'border-red-500'} shadow-sm mb-2"><div class="flex justify-between items-center mb-2"><span class="text-[10px] font-bold uppercase text-gray-500">Prestador: ${nomePrestadorHistorico}</span>${badge}</div>${reviewBtn}</div>`; } }); } if(!hasAndamento) containerAndamento.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Nenhum serviço em andamento.</p>`; if(!hasHistorico) containerHistorico.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Histórico vazio.</p>`; }); }

// Funções Globais
window.aceitarPedido = async (orderId) => { if(!confirm("Aceitar proposta e iniciar serviço?")) return; try { const orderRef = doc(db, "orders", orderId); const orderSnap = await getDoc(orderRef); const pedido = orderSnap.data(); await updateDoc(orderRef, { status: "reserved" }); const chatRef = doc(db, "chats", pedido.chat_id); await setDoc(chatRef, { participants: [pedido.client_id, pedido.provider_id], mission_title: `Serviço: R$ ${pedido.service_value} (Em Andamento)`, last_message: "Proposta aceita! O chat está liberado.", updated_at: serverTimestamp(), is_service_chat: true }); alert("✅ Serviço Aceito! O chat foi liberado."); if(window.switchProviderSubTab) window.switchProviderSubTab('ativos'); } catch(e) { alert("Erro: " + e.message); } };
window.recusarPedido = async (orderId) => { if(!confirm("Recusar proposta?")) return; try { await updateDoc(doc(db, "orders", orderId), { status: "rejected" }); alert("❌ Proposta recusada."); } catch(e) { alert("Erro: " + e.message); } };
window.validarTokenPrestador = async (orderId, valorTotal) => { const input = document.getElementById(`token-${orderId}`); const tokenDigitado = input.value.trim(); if(tokenDigitado.length !== 4) return alert("O código deve ter 4 dígitos."); const btn = event.target; btn.innerText = "Verificando..."; btn.disabled = true; try { const orderRef = doc(db, "orders", orderId); const orderSnap = await getDoc(orderRef); if(!orderSnap.exists()) throw new Error("Pedido não encontrado."); if (tokenDigitado === orderSnap.data().finalization_code) { await updateDoc(orderRef, { status: 'completed', completed_at: serverTimestamp() }); await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { saldo: increment(orderSnap.data().amount_security || 0) }); alert(`✅ SUCESSO!\n\nCódigo Validado Corretamente.\nServiço Encerrado.`); } else { alert("❌ CÓDIGO INVÁLIDO."); input.value = ""; btn.innerText = "VALIDAR & RECEBER"; btn.disabled = false; } } catch (e) { alert("Erro: " + e.message); btn.innerText = "Erro"; btn.disabled = false; } };
window.aceitarChamado = (orderId, chatId, clientName) => { window.switchTab('chat'); setTimeout(() => { if(window.abrirChat) window.abrirChat(chatId, `Negociação com ${clientName}`); }, 500); };
window.abrirModalAvaliacao = (orderId, providerId) => { orderIdParaAvaliar = orderId; providerIdParaAvaliar = providerId; document.getElementById('review-modal').classList.remove('hidden'); };
window.enviarAvaliacao = async () => { let stars = 0; document.querySelectorAll('.rate-star.active').forEach(s => stars = Math.max(stars, s.getAttribute('data-val'))); if(stars === 0) return alert("Selecione pelo menos 1 estrela."); const comment = document.getElementById('review-comment').value.trim(); const tags = []; document.querySelectorAll('.tag-select.selected').forEach(t => tags.push(t.innerText)); const recommend = document.querySelector('input[name="recommend"]:checked').value === 'yes'; const btn = event.target; btn.innerText = "Enviando..."; btn.disabled = true; try { await addDoc(collection(db, "reviews"), { order_id: orderIdParaAvaliar, provider_id: providerIdParaAvaliar, client_id: auth.currentUser.uid, stars: parseInt(stars), tags: tags, comment: comment, recommended: recommend, created_at: serverTimestamp() }); await updateDoc(doc(db, "orders", orderIdParaAvaliar), { is_reviewed: true }); document.getElementById('review-modal').classList.add('hidden'); alert("✅ Avaliação Enviada!"); } catch (e) { alert("Erro: " + e.message); btn.innerText = "Tentar Novamente"; btn.disabled = false; } };
window.gerarTokenCliente = async (orderId) => { const btn = event.target; btn.disabled = true; try { const orderRef = doc(db, "orders", orderId); const docSnap = await getDoc(orderRef); let code = docSnap.data().finalization_code; if (!code) { code = Math.floor(1000 + Math.random() * 9000).toString(); await updateDoc(orderRef, { finalization_code: code }); } alert(`🔑 CÓDIGO DE FINALIZAÇÃO: ${code}\n\nINSTRUÇÃO:\nSó passe este código ao prestador quando o serviço estiver 100% concluído.\nAssim que ele validar, o serviço encerra.`); btn.innerText = "VER CÓDIGO 🔑"; btn.disabled = false; } catch (e) { alert("Erro: " + e.message); btn.disabled = false; } };
window.abrirModalSolicitacao = (uid, nomePrestador, precoBase) => { if(!auth.currentUser) return alert("Faça login."); const hiddenInput = document.getElementById('target-provider-id'); if(hiddenInput) hiddenInput.value = uid; targetProviderEmail = nomePrestador; window.basePriceAtual = parseFloat(precoBase); if(window.togglePriceInput) { document.getElementById('label-base-price').innerText = `Aceitar valor (R$ ${precoBase})`; document.getElementById('price-option-base').checked = false; document.getElementById('price-option-custom').checked = false; document.getElementById('custom-price-container').classList.add('hidden'); document.getElementById('financial-summary').classList.add('hidden'); document.getElementById('btn-confirm-req').disabled = true; document.getElementById('btn-confirm-req').classList.add('opacity-50'); } document.getElementById('request-modal').classList.remove('hidden'); };
window.enviarPropostaAgora = async () => { const hiddenInput = document.getElementById('target-provider-id'); const targetId = hiddenInput ? hiddenInput.value : null; if(!targetId) return alert("Erro crítico: Prestador não identificado. Tente recarregar."); const data = document.getElementById('req-date').value; const hora = document.getElementById('req-time').value; const local = document.getElementById('req-local').value; let valor = 0; if (document.getElementById('price-option-base').checked) { valor = window.basePriceAtual; } else { valor = parseFloat(document.getElementById('req-value').value); } if(!data || !hora || !local || !valor) return alert("Preencha tudo e selecione um valor!"); const btn = document.getElementById('btn-confirm-req'); btn.innerText = "Enviando Proposta..."; btn.disabled = true; try { const seguranca = valor * 0.30; const taxa = valor * 0.10; const reservaTotal = seguranca + taxa; const ids = [auth.currentUser.uid, targetId].sort(); const chatRoomId = `${ids[0]}_${ids[1]}`; await addDoc(collection(db, "orders"), { client_id: auth.currentUser.uid, client_email: auth.currentUser.email, provider_id: targetId, provider_email: targetProviderEmail || "Prestador", service_date: data, service_time: hora, service_location: local, service_value: valor, amount_total_reservation: reservaTotal, amount_security: seguranca, amount_fee: taxa, status: "pending_acceptance", chat_id: chatRoomId, created_at: serverTimestamp() }); document.getElementById('request-modal').classList.add('hidden'); alert(`✅ Proposta Enviada!\n\nReserva Paga (Simulado): R$ ${reservaTotal.toFixed(2)}\nAguarde o aceite do prestador.`); if(window.switchServiceSubTab) window.switchServiceSubTab('andamento'); btn.innerText = "PAGAR E ENVIAR 🔒"; btn.disabled = false; } catch (e) { console.error(e); alert("Erro técnico: " + e.message); btn.innerText = "Tentar Novamente"; btn.disabled = false; } };
