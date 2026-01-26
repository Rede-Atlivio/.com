import { db, auth } from '../app.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variável para guardar os prestadores na memória (para o filtro ser rápido)
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
window.filtrarCategoria = filtrarCategoria; // Agora é uma função real

// ============================================================================
// 1. LISTAGEM DE SERVIÇOS (VITRINE PREMIUM 💎)
// ============================================================================
export async function carregarServicosDisponiveis() {
    const container = document.getElementById('app-container');
    if (!container) return;

    // Cabeçalho da Seção
    container.innerHTML = `
        <div class="p-4 pb-24 animate-fadeIn">
            <div class="flex justify-between items-end mb-4">
                <div>
                    <h2 class="text-2xl font-black text-blue-900">Profissionais</h2>
                    <p class="text-xs text-gray-500">Encontre os melhores especialistas.</p>
                </div>
            </div>
            
            <div class="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
                <button onclick="window.filtrarCategoria('Todos', this)" class="btn-filtro active bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-md transition">Todos</button>
                <button onclick="window.filtrarCategoria('Limpeza', this)" class="btn-filtro bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-gray-50 transition">Limpeza</button>
                <button onclick="window.filtrarCategoria('Obras', this)" class="btn-filtro bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-gray-50 transition">Obras</button>
                <button onclick="window.filtrarCategoria('Técnica', this)" class="btn-filtro bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-gray-50 transition">Técnica</button>
                <button onclick="window.filtrarCategoria('Outros', this)" class="btn-filtro bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-gray-50 transition">Outros</button>
            </div>

            <div id="lista-servicos-render" class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div class="col-span-1 text-center py-10">
                    <div class="loader mx-auto border-blue-200 border-t-blue-600 mb-2"></div>
                    <p class="text-[10px] text-gray-400">Carregando vitrine...</p>
                </div>
            </div>
        </div>

        <div id="modal-contratacao" class="hidden fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"></div>
    `;

    // Busca no Firebase (Apenas uma vez ao carregar a tela)
    const q = query(collection(db, "active_providers"), where("is_online", "==", true), limit(50));
    
    try {
        const snap = await getDocs(q);
        cachePrestadores = []; // Limpa cache

        if (snap.empty) {
            document.getElementById('lista-servicos-render').innerHTML = `
                <div class="col-span-1 md:col-span-2 text-center py-12 opacity-60">
                    <div class="text-5xl mb-3 grayscale">😴</div>
                    <h3 class="font-bold text-gray-700">Ninguém Online Agora</h3>
                    <p class="text-xs text-gray-400 max-w-[200px] mx-auto mt-1">Nossos parceiros estão descansando.</p>
                </div>`;
            return;
        }

        snap.forEach(d => {
            cachePrestadores.push({ id: d.id, ...d.data() });
        });

        // Renderiza tudo inicialmente
        renderizarLista(cachePrestadores);

    } catch (e) {
        console.error(e);
        document.getElementById('lista-servicos-render').innerHTML = `<p class="text-center text-red-500 text-xs">Erro ao carregar vitrine.</p>`;
    }
}

// --- FUNÇÃO DE FILTRO (LÓGICA VISUAL) ---
function filtrarCategoria(categoria, btnElement) {
    // 1. Atualiza visual dos botões
    if(btnElement) {
        document.querySelectorAll('.btn-filtro').forEach(btn => {
            btn.className = "btn-filtro bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap hover:bg-gray-50 transition";
        });
        btnElement.className = "btn-filtro active bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-md transition";
    }

    // 2. Filtra a lista
    const listaRender = document.getElementById('lista-servicos-render');
    listaRender.innerHTML = '<div class="col-span-1 py-10 text-center"><div class="loader mx-auto border-blue-200 border-t-blue-600"></div></div>';

    setTimeout(() => {
        if (categoria === 'Todos') {
            renderizarLista(cachePrestadores);
        } else {
            // Filtra prestadores que tenham PELO MENOS UM serviço na categoria escolhida
            const filtrados = cachePrestadores.filter(p => {
                if (!p.services) return false;
                // Procura se existe algum serviço que contenha a palavra da categoria (ex: "Limpeza" em "Limpeza Residencial")
                return p.services.some(s => s.category.includes(categoria) || (categoria === 'Outros' && !['Limpeza', 'Obras', 'Técnica'].some(c => s.category.includes(c))));
            });
            renderizarLista(filtrados);
        }
    }, 300); // Pequeno delay para dar sensação de processamento
}

// --- RENDERIZADOR DOS CARDS ---
function renderizarLista(lista) {
    const container = document.getElementById('lista-servicos-render');
    container.innerHTML = "";

    if (lista.length === 0) {
        container.innerHTML = `
            <div class="col-span-1 md:col-span-2 text-center py-12 opacity-60">
                <div class="text-4xl mb-2">🔍</div>
                <p class="text-xs text-gray-400">Nenhum profissional nesta categoria.</p>
            </div>`;
        return;
    }

    lista.forEach(prestador => {
        // Fallbacks
        const fotoPerfil = prestador.foto_perfil || 'https://via.placeholder.com/150';
        const temBanner = !!prestador.banner_url;
        const bannerStyle = temBanner 
            ? `background-image: url('${prestador.banner_url}');` 
            : `background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);`; 
        const bio = prestador.bio || "Profissional verificado da plataforma Atlivio.";

        // Pega o serviço principal (ou o primeiro)
        if (prestador.services && prestador.services.length > 0) {
            const servicoPrincipal = prestador.services[0]; 
            
            container.innerHTML += `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group relative animate-fadeIn">
                    
                    <div class="h-24 w-full bg-cover bg-center relative" style="${bannerStyle}">
                        <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition"></div>
                        ${!temBanner ? '<div class="absolute inset-0 flex items-center justify-center opacity-20 text-white font-black text-2xl tracking-widest">ATLIVIO</div>' : ''}
                    </div>

                    <div class="px-5 relative">
                        <div class="absolute -top-8 left-5">
                            <img src="${fotoPerfil}" class="w-16 h-16 rounded-full border-4 border-white shadow-md object-cover bg-white">
                            <div class="absolute bottom-1 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" title="Online"></div>
                        </div>
                    </div>

                    <div class="pt-10 px-5 pb-5">
                        <div class="mb-3">
                            <h3 class="font-black text-gray-800 text-lg leading-tight truncate">${prestador.nome_profissional}</h3>
                            <div class="flex items-center gap-1 mt-1">
                                <span class="text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full">⭐ 5.0</span>
                                <span class="text-[10px] text-gray-400 truncate w-40">${bio}</span>
                            </div>
                        </div>

                        <div class="bg-gray-50 rounded-xl p-3 border border-gray-100 flex justify-between items-center mb-4">
                            <div>
                                <p class="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Especialidade</p>
                                <p class="font-bold text-blue-900 text-sm truncate w-32">${servicoPrincipal.category}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-[9px] text-gray-400">A partir de</p>
                                <p class="font-black text-green-600 text-lg">R$ ${servicoPrincipal.price}</p>
                            </div>
                        </div>

                        <button onclick="window.abrirModalContratacao('${prestador.id || prestador.uid}', '${prestador.nome_profissional}', '${servicoPrincipal.category}', ${servicoPrincipal.price})" 
                            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wide shadow-lg shadow-blue-600/20 transform active:scale-95 transition">
                            Ver Detalhes & Contratar
                        </button>
                    </div>
                </div>
            `;
        }
    });
}

// ============================================================================
// 2. MODAL DE CONTRATAÇÃO (MANTIDO IGUAL)
// ============================================================================
export function abrirModalContratacao(providerId, providerName, category, price) {
    if (!auth.currentUser) return alert("Faça login para solicitar um serviço.");

    const modal = document.getElementById('modal-contratacao');
    modal.classList.remove('hidden');

    modal.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-2xl overflow-hidden animate-slideUp shadow-2xl">
            <div class="bg-slate-900 p-6 text-white text-center relative overflow-hidden">
                <div class="absolute top-0 right-0 w-20 h-20 bg-blue-500 rounded-full blur-2xl opacity-20 -mr-10 -mt-10"></div>
                <h3 class="font-black text-xl relative z-10">Agendar Serviço</h3>
                <p class="text-xs opacity-70 mt-1 relative z-10">Solicite orçamento sem compromisso</p>
                <button onclick="window.fecharModalServico()" class="absolute top-4 right-4 text-white/50 hover:text-white font-bold text-xl">&times;</button>
            </div>
            
            <div class="p-6">
                <div class="flex items-center gap-4 mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div class="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-xl">👷</div>
                    <div>
                        <p class="text-xs text-gray-500">Profissional</p>
                        <p class="font-bold text-blue-900 text-sm">${providerName}</p>
                    </div>
                </div>

                <div class="space-y-4 mb-6">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Data</label>
                            <input type="date" id="req-date" class="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 transition">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Horário</label>
                            <input type="time" id="req-time" class="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 transition">
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Local</label>
                        <input type="text" id="req-local" placeholder="Endereço..." class="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-blue-500 transition">
                    </div>
                </div>

                <div class="flex justify-between items-center border-t border-gray-100 pt-4 mb-6">
                    <p class="text-xs font-bold text-gray-500">Valor Estimado</p>
                    <div class="text-right">
                        <p class="text-2xl font-black text-blue-900">R$ ${price}</p>
                        <p class="text-[9px] text-gray-400">Pagamento no final</p>
                    </div>
                </div>

                <button onclick="window.confirmarSolicitacao('${providerId}', '${providerName}', '${category}', ${price})" class="w-full bg-green-600 text-white py-4 rounded-xl font-black text-sm uppercase shadow-lg hover:bg-green-500 transition flex items-center justify-center gap-2">
                    <span>🚀</span> Enviar Solicitação
                </button>
            </div>
        </div>
    `;
}

// ============================================================================
// 3. ENVIO DE SOLICITAÇÃO (MANTIDO)
// ============================================================================
export async function confirmarSolicitacao(providerId, providerName, category, price) {
    const data = document.getElementById('req-date').value;
    const hora = document.getElementById('req-time').value;
    const local = document.getElementById('req-local').value;

    if(!data || !hora || !local) return alert("Preencha todos os campos.");

    const btn = document.querySelector('button[onclick^="window.confirmarSolicitacao"]');
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
        
        // Cria chat e mensagem
        const orderId = docRef.id;
        await setDoc(doc(db, "chats", orderId), { participants: [user.uid, providerId], order_id: orderId, status: "active", last_message: "Solicitação", updated_at: serverTimestamp() });
        await addDoc(collection(db, `chats/${orderId}/messages`), { text: `👋 Olá! Gostaria de agendar ${category} para ${data} às ${hora}.\n📍 ${local}\n💰 R$ ${price}`, sender_id: user.uid, timestamp: serverTimestamp() });

        alert("✅ Solicitação Enviada!");
        window.fecharModalServico();
        if(window.irParaChat) window.irParaChat();

    } catch (e) {
        alert("Erro: " + e.message);
        btn.innerHTML = "Tentar Novamente";
        btn.disabled = false;
    }
}

export function fecharModalServico() {
    document.getElementById('modal-contratacao').classList.add('hidden');
}
