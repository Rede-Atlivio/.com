import { db, auth } from '../app.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit, setDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let cachePrestadores = [];

// --- GATILHOS ---
const tabServicos = document.getElementById('tab-servicos');
if (tabServicos) {
    tabServicos.addEventListener('click', () => {
        carregarServicosDisponiveis();
    });
}

// Expõe globalmente
window.carregarServicos = carregarServicosDisponiveis;
window.abrirModalContratacao = abrirModalContratacao;
window.confirmarSolicitacao = confirmarSolicitacao;
window.fecharModalServico = fecharModalServico;
window.filtrarCategoria = filtrarCategoria;

// ============================================================================
// 1. LISTAGEM DE SERVIÇOS (VITRINE INTELIGENTE 🧠)
// ============================================================================
export async function carregarServicosDisponiveis() {
    const listaRender = document.getElementById('lista-prestadores-realtime');
    const filtersRender = document.getElementById('category-filters');
    
    if (!listaRender || !filtersRender) return;

    // 1. Renderiza Filtros
    filtersRender.innerHTML = `
        <button onclick="window.filtrarCategoria('Todos', this)" class="btn-filtro active bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-md transition">Todos</button>
        <button onclick="window.filtrarCategoria('Limpeza', this)" class="btn-filtro bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-gray-50 transition">Limpeza</button>
        <button onclick="window.filtrarCategoria('Obras', this)" class="btn-filtro bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-gray-50 transition">Obras</button>
        <button onclick="window.filtrarCategoria('Técnica', this)" class="btn-filtro bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-gray-50 transition">Técnica</button>
        <button onclick="window.filtrarCategoria('Outros', this)" class="btn-filtro bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-gray-50 transition">Outros</button>
    `;

    // 2. Feedback de Carregamento
    listaRender.innerHTML = `
        <div class="col-span-2 text-center py-10">
            <div class="loader mx-auto border-blue-200 border-t-blue-600 mb-2"></div>
            <p class="text-[10px] text-gray-400">Buscando melhores profissionais...</p>
        </div>
    `;

    // 3. BUSCA PODEROSA (Regra do Peso + Offline Permitido)
    // Removemos o 'where is_online == true' para permitir offline
    // Adicionamos 'orderBy visibility_score' para priorizar reais
    try {
        const q = query(
            collection(db, "active_providers"), 
            orderBy("visibility_score", "desc"), // Reais (100) primeiro, Demos (10) depois
            limit(50)
        );
        
        const snap = await getDocs(q);
        cachePrestadores = []; 

        if (snap.empty) {
            listaRender.innerHTML = `
                <div class="col-span-2 text-center py-12 opacity-60">
                    <div class="text-5xl mb-3 grayscale">🏜️</div>
                    <h3 class="font-bold text-gray-700">Nenhum profissional encontrado.</h3>
                </div>`;
            return;
        }

        snap.forEach(d => {
            cachePrestadores.push({ id: d.id, ...d.data() });
        });

        renderizarLista(cachePrestadores);

    } catch (e) {
        console.error(e);
        // Se der erro de índice (comum ao adicionar orderBy), avisa no console
        if(e.message.includes("index")) {
            console.warn("⚠️ ATENÇÃO ADMIN: É necessário criar um índice no Firebase. Clique no link que apareceu no erro acima.");
        }
        listaRender.innerHTML = `<p class="col-span-2 text-center text-red-500 text-xs">Erro ao carregar. Verifique o console.</p>`;
    }
}

function filtrarCategoria(categoria, btnElement) {
    if(btnElement) {
        document.querySelectorAll('.btn-filtro').forEach(btn => {
            btn.className = "btn-filtro bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-gray-50 transition";
        });
        btnElement.className = "btn-filtro active bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-md transition";
    }

    const listaRender = document.getElementById('lista-prestadores-realtime');
    listaRender.innerHTML = '<div class="col-span-2 py-10 text-center"><div class="loader mx-auto border-blue-200 border-t-blue-600"></div></div>';

    setTimeout(() => {
        if (categoria === 'Todos') {
            renderizarLista(cachePrestadores);
        } else {
            const filtrados = cachePrestadores.filter(p => {
                if (!p.services) return false;
                return p.services.some(s => s.category.includes(categoria) || (categoria === 'Outros' && !['Limpeza', 'Obras', 'Técnica'].some(c => s.category.includes(c))));
            });
            renderizarLista(filtrados);
        }
    }, 300);
}

// --- RENDERIZADOR COM INTELIGÊNCIA VISUAL ---
function renderizarLista(lista) {
    const container = document.getElementById('lista-prestadores-realtime');
    container.innerHTML = "";

    if (lista.length === 0) {
        container.innerHTML = `
            <div class="col-span-2 text-center py-12 opacity-60">
                <div class="text-4xl mb-2">🔍</div>
                <p class="text-xs text-gray-400">Nenhum profissional nesta categoria.</p>
            </div>`;
        return;
    }

    lista.forEach(prestador => {
        // 1. Tratamento de Dados Básicos
        const nomeSafe = prestador.nome_profissional || "Profissional";
        const fotoPerfil = prestador.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeSafe)}&background=random&color=fff`;
        const temBanner = !!prestador.banner_url;
        const bannerStyle = temBanner 
            ? `background-image: url('${prestador.banner_url}');` 
            : `background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);`; 
        const bio = prestador.bio || "Profissional verificado.";

        // 2. Lógica de Status (ONLINE vs OFFLINE)
        const isOnline = prestador.is_online === true;
        
        // Estilos Visuais Condicionais
        let containerClass = "bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group relative animate-fadeIn";
        let btnText = "Ver & Contratar";
        let btnClass = "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-wide shadow-md transform active:scale-95 transition";
        let statusDot = `<div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" title="Online"></div>`;
        
        if (!isOnline) {
            // MODO CINZA (OFFLINE)
            containerClass += " grayscale opacity-90"; // Deixa preto e branco
            btnText = "📅 Agendar"; // Muda o texto
            btnClass = "w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-wide shadow-md transition"; // Botão escuro
            statusDot = `<div class="absolute bottom-0 right-0 w-3 h-3 bg-gray-400 border-2 border-white rounded-full" title="Offline (Apenas Agendamento)"></div>`;
        }

        if (prestador.services && prestador.services.length > 0) {
            const servicoPrincipal = prestador.services[0];
            
            // 3. Lógica Multi-Service
            const qtdExtras = prestador.services.length - 1;
            const badgeExtra = qtdExtras > 0 
                ? `<span class="ml-1 text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">+${qtdExtras}</span>` 
                : "";
            
            container.innerHTML += `
                <div class="${containerClass}">
                    
                    <div class="h-20 w-full bg-cover bg-center relative" style="${bannerStyle}">
                        <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition"></div>
                        ${!temBanner ? '<div class="absolute inset-0 flex items-center justify-center opacity-20 text-white font-black text-xl tracking-widest">ATLIVIO</div>' : ''}
                        
                        ${!isOnline ? '<div class="absolute top-2 right-2 bg-black/60 text-white text-[8px] font-bold px-2 py-1 rounded backdrop-blur-sm">APENAS AGENDAMENTO</div>' : ''}
                    </div>

                    <div class="px-4 relative">
                        <div class="absolute -top-6 left-4">
                            <img src="${fotoPerfil}" class="w-12 h-12 rounded-full border-4 border-white shadow-md object-cover bg-white">
                            ${statusDot}
                        </div>
                    </div>

                    <div class="pt-8 px-4 pb-4">
                        <div class="mb-2">
                            <h3 class="font-black text-gray-800 text-sm leading-tight truncate">${nomeSafe}</h3>
                            <div class="flex items-center gap-1 mt-1">
                                <span class="text-[9px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded-full">⭐ 5.0</span>
                                <span class="text-[9px] text-gray-400 truncate w-32">${bio}</span>
                            </div>
                        </div>

                        <div class="bg-gray-50 rounded-lg p-2 border border-gray-100 flex justify-between items-center mb-3">
                            <div class="flex items-center">
                                <div>
                                    <p class="text-[8px] uppercase font-bold text-gray-400 tracking-wider">Especialidade</p>
                                    <div class="flex items-center">
                                        <p class="font-bold text-blue-900 text-xs truncate max-w-[80px]">${servicoPrincipal.category}</p>
                                        ${badgeExtra}
                                    </div>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-[8px] text-gray-400">A partir de</p>
                                <p class="font-black text-green-600 text-sm">R$ ${servicoPrincipal.price}</p>
                            </div>
                        </div>

                        <button onclick="window.abrirModalContratacao('${prestador.id || prestador.uid}', '${prestador.nome_profissional}', '${servicoPrincipal.category}', ${servicoPrincipal.price})" 
                            class="${btnClass}">
                            ${btnText}
                        </button>
                    </div>
                </div>
            `;
        }
    });
}

// 2. MODAL DE CONTRATAÇÃO
export function abrirModalContratacao(providerId, providerName, category, price) {
    if (!auth.currentUser) return alert("Faça login para solicitar um serviço.");

    const modal = document.getElementById('modal-contratacao');
    if(!modal) {
        const newModal = document.createElement('div');
        newModal.id = 'modal-contratacao';
        newModal.className = 'hidden fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4';
        document.body.appendChild(newModal);
        return abrirModalContratacao(providerId, providerName, category, price);
    }
    
    modal.classList.remove('hidden');

    modal.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-2xl overflow-hidden animate-slideUp shadow-2xl">
            <div class="bg-slate-900 p-5 text-white text-center relative overflow-hidden">
                <div class="absolute top-0 right-0 w-20 h-20 bg-blue-500 rounded-full blur-2xl opacity-20 -mr-10 -mt-10"></div>
                <h3 class="font-black text-lg relative z-10">Agendar Serviço</h3>
                <p class="text-xs opacity-70 mt-1 relative z-10">Combine data e hora com o profissional</p>
                <button onclick="window.fecharModalServico()" class="absolute top-4 right-4 text-white/50 hover:text-white font-bold text-xl">&times;</button>
            </div>
            
            <div class="p-5">
                <div class="flex items-center gap-3 mb-5 bg-blue-50 p-3 rounded-xl border border-blue-100">
                    <div class="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-lg">👷</div>
                    <div>
                        <p class="text-[10px] text-gray-500 uppercase font-bold">Profissional</p>
                        <p class="font-bold text-blue-900 text-xs">${providerName}</p>
                    </div>
                </div>

                <div class="space-y-3 mb-5">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Data</label>
                            <input type="date" id="req-date" class="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs outline-none focus:border-blue-500 transition">
                        </div>
                        <div>
                            <label class="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Horário</label>
                            <input type="time" id="req-time" class="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs outline-none focus:border-blue-500 transition">
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Local</label>
                        <input type="text" id="req-local" placeholder="Endereço..." class="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs outline-none focus:border-blue-500 transition">
                    </div>
                </div>

                <div class="flex justify-between items-center border-t border-gray-100 pt-4 mb-5">
                    <p class="text-xs font-bold text-gray-500">Valor Estimado</p>
                    <div class="text-right">
                        <p class="text-xl font-black text-blue-900">R$ ${price}</p>
                        <p class="text-[8px] text-gray-400">Pagamento no final</p>
                    </div>
                </div>

                <button onclick="window.confirmarSolicitacao('${providerId}', '${providerName}', '${category}', ${price})" class="w-full bg-green-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg hover:bg-green-500 transition flex items-center justify-center gap-2">
                    <span>🚀</span> Enviar Solicitação
                </button>
            </div>
        </div>
    `;
}

// 3. ENVIO
export async function confirmarSolicitacao(providerId, providerName, category, price) {
    const data = document.getElementById('req-date').value;
    const hora = document.getElementById('req-time').value;
    const local = document.getElementById('req-local').value;

    if(!data || !hora || !local) return alert("Preencha todos os campos.");

    const btn = document.querySelector('button[onclick^="window.confirmarSolicitacao"]');
    const txt = btn.innerHTML;
    btn.innerHTML = "Enviando...";
    btn.disabled = true;

    try {
        const user = auth.currentUser;
        const orderData = {
            client_id: user.uid,
            client_name: user.displayName || "Cliente",
            client_phone: "Não informado", 
            provider_id: providerId,
            provider_name: providerName,
            service_category: category,
            offer_value: parseFloat(price),
            service_date: data,
            service_time: hora,
            location: local,
            status: 'pending', 
            created_at: serverTimestamp(),
            security_code: Math.floor(1000 + Math.random() * 9000).toString() 
        };

        const docRef = await addDoc(collection(db, "orders"), orderData);
        
        const orderId = docRef.id;
        await setDoc(doc(db, "chats", orderId), { participants: [user.uid, providerId], order_id: orderId, status: "active", last_message: "Solicitação", updated_at: serverTimestamp() });
        await addDoc(collection(db, `chats/${orderId}/messages`), { text: `👋 Olá! Gostaria de agendar ${category} para ${data} às ${hora}.\n📍 ${local}\n💰 R$ ${price}`, sender_id: user.uid, timestamp: serverTimestamp() });

        alert("✅ Solicitação Enviada!");
        window.fecharModalServico();
        if(window.irParaChat) window.irParaChat();

    } catch (e) {
        alert("Erro: " + e.message);
        btn.innerHTML = txt;
        btn.disabled = false;
    }
}

export function fecharModalServico() {
    const modal = document.getElementById('modal-contratacao');
    if(modal) modal.classList.add('hidden');
}

window.filtrarCategoria = filtrarCategoria;
