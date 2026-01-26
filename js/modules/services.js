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
// 1. LISTAGEM DE SERVIÇOS (VITRINE)
// ============================================================================
export async function carregarServicosDisponiveis() {
    const container = document.getElementById('app-container');
    if (!container) return;

    container.innerHTML = `
        <div class="p-4 pb-24 animate-fadeIn">
            <h2 class="text-xl font-black text-blue-900 mb-2">🛠️ Contratar Profissional</h2>
            <p class="text-xs text-gray-500 mb-6">Escolha uma categoria e encontre os melhores.</p>
            
            <div class="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
                <button onclick="window.filtrarCategoria('Todos')" class="bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-md">Todos</button>
                <button onclick="window.filtrarCategoria('Limpeza')" class="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap">Limpeza</button>
                <button onclick="window.filtrarCategoria('Obras')" class="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap">Obras</button>
                <button onclick="window.filtrarCategoria('Técnica')" class="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap">Técnica</button>
            </div>

            <div id="lista-servicos-render" class="grid grid-cols-1 gap-4">
                <div class="loader mx-auto border-blue-200 border-t-blue-600 mt-10"></div>
            </div>
        </div>

        <div id="modal-contratacao" class="hidden fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            </div>
    `;

    // Busca prestadores ativos
    const listaRender = document.getElementById('lista-servicos-render');
    const q = query(collection(db, "active_providers"), where("is_online", "==", true), limit(50));
    
    try {
        const snap = await getDocs(q);
        listaRender.innerHTML = "";
        
        if (snap.empty) {
            listaRender.innerHTML = `
                <div class="text-center py-10 opacity-60">
                    <div class="text-4xl mb-2">😴</div>
                    <p class="text-sm font-bold">Nenhum prestador online.</p>
                    <p class="text-xs">Tente novamente mais tarde.</p>
                </div>`;
            return;
        }

        snap.forEach(d => {
            const prestador = d.data();
            // Se o prestador tiver serviços cadastrados
            if (prestador.services && prestador.services.length > 0) {
                prestador.services.forEach(servico => {
                    listaRender.innerHTML += `
                        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-4 items-center">
                            <img src="${prestador.foto_perfil || 'https://via.placeholder.com/50'}" class="w-12 h-12 rounded-full object-cover border border-gray-200">
                            <div class="flex-1">
                                <h3 class="font-bold text-gray-800 text-sm">${servico.category}</h3>
                                <p class="text-[10px] text-gray-500 line-clamp-1">${servico.description || 'Profissional qualificado'}</p>
                                <p class="text-[10px] text-blue-600 font-bold mt-1">Por: ${prestador.nome_profissional}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-lg font-black text-blue-900">R$ ${servico.price}</p>
                                <button onclick="window.abrirModalContratacao('${d.id}', '${prestador.nome_profissional}', '${servico.category}', ${servico.price})" class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase shadow-lg hover:bg-blue-500 transition">
                                    Contratar
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
        });
    } catch (e) {
        console.error(e);
        listaRender.innerHTML = `<p class="text-center text-red-500 text-xs">Erro ao carregar serviços.</p>`;
    }
}

// ============================================================================
// 2. MODAL DE CONTRATAÇÃO
// ============================================================================
export function abrirModalContratacao(providerId, providerName, category, price) {
    if (!auth.currentUser) return alert("Faça login para solicitar um serviço.");

    const modal = document.getElementById('modal-contratacao');
    modal.classList.remove('hidden');

    modal.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-2xl overflow-hidden animate-slideUp">
            <div class="bg-blue-600 p-4 text-white text-center">
                <h3 class="font-bold text-lg">Solicitar Serviço</h3>
                <p class="text-xs opacity-80">Você pagará diretamente ao prestador</p>
            </div>
            
            <div class="p-6">
                <div class="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
                    <div>
                        <p class="text-xs text-gray-400 uppercase font-bold">Profissional</p>
                        <p class="font-bold text-gray-800">${providerName}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs text-gray-400 uppercase font-bold">Serviço</p>
                        <p class="font-bold text-blue-600">${category}</p>
                    </div>
                </div>

                <div class="space-y-3 mb-6">
                    <div>
                        <label class="text-[10px] font-bold text-gray-500 uppercase">Data</label>
                        <input type="date" id="req-date" class="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-gray-500 uppercase">Horário</label>
                        <input type="time" id="req-time" class="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-gray-500 uppercase">Local (Endereço)</label>
                        <input type="text" id="req-local" placeholder="Ex: Rua das Flores, 123" class="w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm">
                    </div>
                </div>

                <div class="bg-gray-50 p-4 rounded-xl text-center mb-6 border border-gray-200">
                    <p class="text-xs text-gray-400 font-bold uppercase">Valor Total</p>
                    <p class="text-3xl font-black text-blue-900">R$ ${price}</p>
                    <p class="text-[10px] text-gray-400 mt-1">Pagamento no final (Pix/Dinheiro)</p>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <button onclick="window.fecharModalServico()" class="bg-gray-200 text-gray-600 py-3 rounded-xl font-bold text-xs uppercase">Cancelar</button>
                    <button onclick="window.confirmarSolicitacao('${providerId}', '${providerName}', '${category}', ${price})" class="bg-green-600 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg hover:bg-green-500">
                        SOLICITAR AGORA
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// 3. CONFIRMAÇÃO (CRIA PEDIDO + CRIA CHAT COM MENSAGEM CORRETA)
// ============================================================================
export async function confirmarSolicitacao(providerId, providerName, category, price) {
    const data = document.getElementById('req-date').value;
    const hora = document.getElementById('req-time').value;
    const local = document.getElementById('req-local').value;

    if(!data || !hora || !local) return alert("Preencha data, hora e local.");

    const btn = document.querySelector('button[onclick^="window.confirmarSolicitacao"]');
    btn.innerText = "ENVIANDO...";
    btn.disabled = true;

    try {
        const user = auth.currentUser;
        
        // 1. Cria o Pedido (Order)
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

        // 2. CRIA O CHAT AUTOMATICAMENTE (Para não ficar vazio)
        await setDoc(doc(db, "chats", orderId), {
            participants: [user.uid, providerId],
            order_id: orderId,
            status: "active",
            last_message: "Solicitação enviada",
            updated_at: serverTimestamp()
        });

        // 3. ENVIA A PRIMEIRA MENSAGEM (CORRETA)
        // Aqui removemos a lógica de "reserva" e colocamos o texto certo
        const mensagemAutomatica = `👋 Olá! Gostaria de agendar o serviço de ${category} para o dia ${data} às ${hora}. O valor total é R$ ${price}. Aguardo seu aceite!`;

        await addDoc(collection(db, `chats/${orderId}/messages`), {
            text: mensagemAutomatica,
            sender_id: user.uid,
            timestamp: serverTimestamp()
        });

        // Feedback e Redirecionamento
        alert("✅ Solicitação Enviada!\n\nVocê será notificado quando o prestador aceitar.");
        window.fecharModalServico();
        
        if(window.irParaChat) window.irParaChat();

    } catch (e) {
        console.error(e);
        alert("Erro ao solicitar: " + e.message);
        btn.innerText = "TENTAR NOVAMENTE";
        btn.disabled = false;
    }
}

export function fecharModalServico() {
    document.getElementById('modal-contratacao').classList.add('hidden');
}

window.filtrarCategoria = (cat) => {
    alert("Filtro por categoria: " + cat + " (Em breve)");
};
