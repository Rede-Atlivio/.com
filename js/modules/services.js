import { db, auth } from '../app.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
                <button onclick="window.filtrarCategoria('Todos')" class="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    Ver Todos
                </button>
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

    const listaRender = document.getElementById('lista-servicos-render');
    
    // Busca APENAS quem está ONLINE (Isso já filtra os "Em Análise" que o auth.js bloqueia)
    const q = query(collection(db, "active_providers"), where("is_online", "==", true), limit(50));
    
    try {
        const snap = await getDocs(q);
        listaRender.innerHTML = "";
        
        if (snap.empty) {
            listaRender.innerHTML = `
                <div class="col-span-1 md:col-span-2 text-center py-12 opacity-60">
                    <div class="text-5xl mb-3 grayscale">😴</div>
                    <h3 class="font-bold text-gray-700">Ninguém Online Agora</h3>
                    <p class="text-xs text-gray-400 max-w-[200px] mx-auto mt-1">Nossos parceiros estão descansando. Tente mais tarde.</p>
                </div>`;
            return;
        }

        snap.forEach(d => {
            const prestador = d.data();
            
            // Tratamento de Imagens (Fallback se não tiver)
            const fotoPerfil = prestador.foto_perfil || 'https://via.placeholder.com/150';
            // Se tiver banner, usa. Se não, usa um degradê azul bonito padrão do Atlivio.
            const temBanner = !!prestador.banner_url;
            const bannerStyle = temBanner 
                ? `background-image: url('${prestador.banner_url}');` 
                : `background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);`; 

            // Tratamento de Texto
            const bio = prestador.bio || "Profissional verificado da plataforma Atlivio.";
            
            // Loop pelos serviços (Um Card por Serviço Principal ou Agrupado)
            // Para a vitrine não ficar repetida, vamos mostrar o CARD DO PRESTADOR com o serviço principal destacado
            if (prestador.services && prestador.services.length > 0) {
                const servicoPrincipal = prestador.services[0]; // Pega o primeiro como destaque
                
                listaRender.innerHTML += `
                    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group relative">
                        
                        <div class="h-24 w-full bg-cover bg-center relative" style="${bannerStyle}">
                            <div class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition"></div>
                            ${!temBanner ? '<div class="absolute inset-0 flex items-center justify-center opacity-20 text-white font-black text-2xl tracking-widest">ATLIVIO</div>' : ''}
                        </div>

                        <div class="px-5 relative">
                            <div class="absolute -top-8 left-5">
                                <img src="${fotoPerfil}" class="w-16 h-16 rounded-full border-4 border-white shadow-md object-cover bg-white">
                                <div class="absolute bottom-1 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" title="Online"></div>
                            </div>
                            
                            <button class="absolute top-3 right-5 text-gray-300 hover:text-red-500 transition">♥</button>
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

                            <button onclick="window.abrirModalContratacao('${d.id}', '${prestador.nome_profissional}', '${servicoPrincipal.category}', ${servicoPrincipal.price})" 
                                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wide shadow-lg shadow-blue-600/20 transform active:scale-95 transition">
                                Ver Detalhes & Contratar
                            </button>
                        </div>
                    </div>
                `;
            }
        });
    } catch (e) {
        console.error(e);
        listaRender.innerHTML = `<p class="text-center text-red-500 text-xs">Erro ao carregar vitrine.</p>`;
    }
}

// ============================================================================
// 2. MODAL DE CONTRATAÇÃO (PAGAMENTO NO FINAL)
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
                <p class="text-xs opacity-70 mt-1 relative z-10">Combine data e hora com o profissional</p>
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
                            <input type="date" id="req-date" class="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition">
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Horário</label>
                            <input type="time" id="req-time" class="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition">
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Onde será o serviço?</label>
                        <input type="text" id="req-local" placeholder="Rua, número e bairro..." class="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition">
                    </div>
                </div>

                <div class="flex justify-between items-center border-t border-gray-100 pt-4 mb-6">
                    <p class="text-xs font-bold text-gray-500">Total Estimado</p>
                    <div class="text-right">
                        <p class="text-2xl font-black text-blue-900">R$ ${price}</p>
                        <p class="text-[9px] text-gray-400">Pagamento direto ao prestador</p>
                    </div>
                </div>

                <button onclick="window.confirmarSolicitacao('${providerId}', '${providerName}', '${category}', ${price})" class="w-full bg-green-600 text-white py-4 rounded-xl font-black text-sm uppercase shadow-lg shadow-green-600/30 hover:bg-green-500 transform active:scale-95 transition flex items-center justify-center gap-2">
                    <span>🚀</span> Enviar Solicitação
                </button>
                <p class="text-[9px] text-center text-gray-400 mt-3">Ao solicitar, você concorda com os termos.</p>
            </div>
        </div>
    `;
}

// ============================================================================
// 3. LOGICA DE ENVIO (MANTIDA E SEGURA)
// ============================================================================
export async function confirmarSolicitacao(providerId, providerName, category, price) {
    const data = document.getElementById('req-date').value;
    const hora = document.getElementById('req-time').value;
    const local = document.getElementById('req-local').value;

    if(!data || !hora || !local) return alert("Por favor, preencha todos os campos (Data, Hora e Local).");

    const btn = document.querySelector('button[onclick^="window.confirmarSolicitacao"]');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = "Processando...";
    btn.disabled = true;

    try {
        const user = auth.currentUser;
        
        // 1. Cria Pedido
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

        // 2. Cria Chat
        await setDoc(doc(db, "chats", orderId), {
            participants: [user.uid, providerId],
            order_id: orderId,
            status: "active",
            last_message: "Solicitação de serviço",
            updated_at: serverTimestamp()
        });

        // 3. Mensagem Automática (Sem reserva, texto limpo)
        const msgAuto = `👋 Olá! Gostaria de agendar o serviço de ${category} para o dia ${data} às ${hora}.\n📍 Local: ${local}\n💰 Valor Total: R$ ${price}\n\nFico no aguardo da confirmação!`;

        await addDoc(collection(db, `chats/${orderId}/messages`), {
            text: msgAuto,
            sender_id: user.uid,
            timestamp: serverTimestamp()
        });

        alert("✅ Solicitação Enviada com Sucesso!");
        window.fecharModalServico();
        
        if(window.irParaChat) window.irParaChat();

    } catch (e) {
        console.error(e);
        alert("Erro ao enviar: " + e.message);
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}

export function fecharModalServico() {
    document.getElementById('modal-contratacao').classList.add('hidden');
}

window.filtrarCategoria = (cat) => {
    // Implementação simples de feedback visual
    alert(`Filtro '${cat}' selecionado.\n(No futuro isso filtrará a lista abaixo)`);
};
