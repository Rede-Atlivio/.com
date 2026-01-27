import { getFirestore, collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

export async function init() {
    console.log("🚀 Módulo Oportunidades Iniciado");
    const container = document.getElementById('lista-oportunidades');
    if(container) loadOpportunities(container);
}

function loadOpportunities(container) {
    container.innerHTML = `<div class="text-center py-6"><div class="loader mx-auto mb-2 border-purple-200 border-t-purple-600"></div></div>`;

    // Busca Oportunidades (Sem filtro de 'is_demo' para mostrar tudo misturado, ou filtre se preferir)
    // Ordena por criação para pegar as novas do Robô
    const q = query(collection(db, "oportunidades"), orderBy("created_at", "desc"));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        
        if (snap.empty) {
            container.innerHTML = `<p class="text-center text-gray-400 text-xs py-4">Nenhuma oportunidade no momento.</p>`;
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            const isDemo = data.is_demo === true;
            
            // Ícone e Cor baseados no tipo
            let icon = "⚡";
            let colorClass = "blue";
            if (data.tipo === 'cashback') { icon = "💸"; colorClass = "green"; }
            if (data.tipo === 'indique') { icon = "🤝"; colorClass = "purple"; }

            // Badge Demo
            const demoBadge = isDemo ? `<span class="bg-gray-100 text-gray-500 text-[8px] border border-gray-200 px-1 rounded ml-2">SIMULAÇÃO</span>` : "";

            // AQUI ESTÁ A CORREÇÃO:
            // Passamos os dados para a função verOportunidade em vez de abrir direto
            // Tratamos as aspas simples no link para não quebrar o HTML
            const safeLink = (data.link || "").replace(/'/g, "\\'");
            const safeTitle = (data.titulo || "").replace(/'/g, "\\'");

            container.innerHTML += `
                <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center animate-fadeIn">
                    <div class="flex items-center gap-3">
                        <div class="bg-${colorClass}-100 text-${colorClass}-600 p-3 rounded-full text-xl">
                            ${icon}
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-800 text-sm flex items-center">
                                ${data.titulo} ${demoBadge}
                            </h4>
                            <p class="text-[10px] text-gray-500 line-clamp-1">${data.descricao}</p>
                        </div>
                    </div>
                    <button onclick="window.verOportunidade('${safeLink}', ${isDemo}, '${safeTitle}')" class="bg-${colorClass}-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase shadow-md active:scale-95 transition">
                        VER
                    </button>
                </div>
            `;
        });
    });
}

// --- FUNÇÃO INTELIGENTE DE CLIQUE ---
window.verOportunidade = (link, isDemo, titulo) => {
    if (isDemo) {
        // Lógica Demo (Alerta Educativo)
        alert(`ℹ️ MODO DEMONSTRAÇÃO\n\nEsta oportunidade "${titulo}" serve para ilustrar o formato de ganho (Cashback ou Indicação).\n\nEm um cenário real, você seria redirecionado para o link do parceiro.`);
    } else {
        // Lógica Real (Abre Link)
        if (!link || link === "#") {
            alert("Link indisponível no momento.");
        } else {
            window.open(link, '_blank');
        }
    }
};
