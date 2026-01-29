import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ============================================================================
// 1. CONFIGURAÇÃO FIREBASE (NÃO MEXER)
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
  authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
  projectId: "atlivio-oficial-a1a29",
  storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
  messagingSenderId: "887430049204",
  appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Exposição Global (Vital para consoles e outros scripts)
window.auth = auth;
window.db = db;
window.storage = storage;
window.provider = provider;

export { app, auth, db, storage, provider };

// ============================================================================
// 2. MÓDULOS (CÉREBRO DO SISTEMA)
// ============================================================================
import './auth.js';                  
import './modules/services.js';      
import './modules/jobs.js';          
import './modules/opportunities.js'; 
import './modules/chat.js';          
import { checkOnboarding } from './modules/onboarding.js';
import { abrirConfiguracoes } from './modules/profile.js';

// Gatilho de Onboarding e Configurações
auth.onAuthStateChanged((user) => {
    if (user) checkOnboarding(user);
});
window.abrirConfiguracoes = abrirConfiguracoes;

console.log("✅ Sistema Atlivio Carregado: App + Todos os Módulos.");

// ============================================================================
// 🛡️ PROTOCOLO GUARDIÃO: RENDERIZAÇÃO DE PRESTADORES
// (Aqui está a lógica do botão que sumiu)
// ============================================================================

window.carregarServicos = async () => {
    // 1. Carrega as Categorias (Botões de Filtro)
    const categoriasContainer = document.getElementById('categorias-wrapper');
    if(categoriasContainer) {
        // Exemplo fixo ou vindo do banco. Mantendo fixo para performance por enquanto.
        const cats = [
            "Todas", "🛠️ Montagem de Móveis", "🛠️ Reparos Elétricos", "🛠️ Instalação de Ventilador", 
            "🛠️ Pintura", "🛠️ Limpeza Residencial", "🛠️ Diarista", "🛠️ Jardinagem", 
            "🛠️ Encanador", "🛠️ Pedreiro", "💅 Manicure/Pedicure", "💇 Cabeleireiro(a)", "🚗 Motorista"
        ];
        
        categoriasContainer.innerHTML = cats.map(c => `
            <button onclick="window.filtrarPrestadores('${c}')" class="whitespace-nowrap px-4 py-2 rounded-full bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition shadow-sm snap-center">
                ${c}
            </button>
        `).join('');
    }

    // 2. Carrega Todos os Prestadores Inicialmente
    window.filtrarPrestadores('Todas');
};

window.filtrarPrestadores = async (categoria) => {
    const container = document.getElementById('lista-prestadores');
    if(!container) return;
    
    container.innerHTML = `<div class="col-span-full text-center py-10"><div class="animate-spin text-4xl">⏳</div><p class="text-xs text-gray-400 mt-2">Buscando profissionais...</p></div>`;

    try {
        let q;
        const colRef = collection(db, "active_providers");
        
        if (categoria === 'Todas') {
            q = query(colRef, where("status", "==", "aprovado"), orderBy("is_online", "desc")); // Online primeiro
        } else {
            // Filtro complexo (exige índice, mas vamos tentar filtro simples no cliente se der erro)
            // Nota: Para filtrar array no firebase usa-se 'array-contains'.
            // Aqui assumo que o filtro busca na lista local ou faz query simples.
            // Para simplificar e evitar erro de índice agora, vou pegar todos aprovados e filtrar no JS.
            q = query(colRef, where("status", "==", "aprovado"));
        }

        const snap = await getDocs(q);
        let lista = [];
        
        snap.forEach(doc => {
            const data = doc.data();
            // Filtro de Categoria no JS (Mais seguro sem índice composto)
            if (categoria === 'Todas' || (data.services && data.services.some(s => s.category === categoria))) {
                lista.push(data);
            }
        });

        // Ordena: Online primeiro
        lista.sort((a, b) => (b.is_online === true) - (a.is_online === true));

        renderizarPrestadores(lista);

    } catch (e) {
        console.error("Erro ao buscar prestadores:", e);
        container.innerHTML = `<div class="col-span-full text-center py-10 text-red-400 text-xs">Erro ao carregar lista.<br>${e.message}</div>`;
    }
};

// AQUI ESTA O SEU BOTÃO DE VOLTA 👇
window.renderizarPrestadores = (lista) => {
    const container = document.getElementById('lista-prestadores');
    if (!container) return;
    container.innerHTML = "";

    if (lista.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 opacity-50 animate-fade">
                <div class="text-6xl mb-4">😢</div>
                <p class="font-bold text-gray-500">Nenhum prestador encontrado.</p>
            </div>`;
        return;
    }

    lista.forEach(p => {
        // --- LÓGICA DO BOTÃO (GUARDIÃO) ---
        const isOnline = p.is_online === true;
        
        // ONLINE: Verde, "VER E SOLICITAR"
        // OFFLINE: Cinza, "AGENDAR VISITA"
        const btnLabel = isOnline ? "⚡ VER E SOLICITAR" : "📅 AGENDAR VISITA";
        const btnColor = isOnline 
            ? "bg-green-600 hover:bg-green-500 text-white shadow-green-500/30 shadow-lg border-b-4 border-green-800 active:border-b-0 active:translate-y-1" 
            : "bg-slate-200 text-slate-500 hover:bg-slate-300 border-b-4 border-slate-300 active:border-b-0 active:translate-y-1";

        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 hover:shadow-md transition animate-fade group";
        
        // Pega o menor preço para exibir "A partir de..."
        let minPrice = 0;
        if(p.services && p.services.length > 0) {
            minPrice = Math.min(...p.services.map(s => Number(s.price)));
        }

        card.innerHTML = `
            <div class="flex gap-3">
                <div class="relative">
                    <img src="${p.foto_perfil || 'assets/default-user.png'}" class="w-14 h-14 rounded-full object-cover border border-gray-200 group-hover:scale-105 transition">
                    ${isOnline ? '<span class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full animate-pulse"></span>' : ''}
                </div>
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <h3 class="font-black text-slate-800 text-sm leading-tight">${p.nome_profissional || 'Prestador'}</h3>
                        <div class="flex items-center gap-1 bg-yellow-50 px-1.5 py-0.5 rounded text-[10px] text-yellow-700 font-bold border border-yellow-100">
                            <span>⭐ 5.0</span>
                        </div>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wide">${p.services ? p.services[0]?.category : 'Geral'}</p>
                    ${minPrice > 0 ? `<p class="text-xs text-slate-600 mt-1">A partir de <strong class="text-blue-600">R$ ${minPrice.toFixed(2)}</strong></p>` : ''}
                </div>
            </div>

            <button onclick="window.abrirPerfilPrestador('${p.uid}')" class="w-full py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase transition flex items-center justify-center gap-2 ${btnColor}">
                ${btnLabel}
            </button>
        `;
        
        container.appendChild(card);
    });
};

// Função auxiliar para abrir perfil (Necessária para o botão funcionar)
window.abrirPerfilPrestador = async (uid) => {
    // Redireciona para o services.js que gerencia o modal detalhado
    if(window.carregarDetalhesPrestador) {
        window.carregarDetalhesPrestador(uid);
    } else {
        alert("Erro: Módulo de Serviços não carregou corretamente. Recarregue a página.");
    }
};

// ============================================================================
// 3. NAVEGAÇÃO ENTRE ABAS (TAB SYSTEM)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    
    // Inicializa a aba padrão (Serviços)
    if(window.carregarServicos) window.carregarServicos();

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove ativo de todos
            tabs.forEach(t => {
                t.classList.remove('text-blue-600', 'active-tab');
                t.classList.add('text-gray-400');
                const icon = t.querySelector('i'); // Lucide icon wrapper
                if(icon) icon.style.stroke = "currentColor";
            });

            // Ativa o clicado
            tab.classList.add('text-blue-600', 'active-tab');
            tab.classList.remove('text-gray-400');

            // Esconde todas as views
            document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));

            // Mostra a view certa
            const viewId = tab.dataset.target;
            const view = document.getElementById(viewId);
            if(view) {
                view.classList.remove('hidden');
                
                // Dispara carregamento específico se necessário
                if(viewId === 'servicos-cliente' && window.carregarServicos) window.carregarServicos();
                if(viewId === 'vagas-view' && window.carregarVagas) window.carregarVagas();
                if(viewId === 'oportunidades-view' && window.carregarOportunidades) window.carregarOportunidades();
            }
        });
    });
});
