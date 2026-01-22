import { db } from '../app.js';
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO DE SEGURANÇA ---
// Evita que o listener seja recriado infinitamente
let listenerLojaAtivo = false;

export function carregarProdutos() {
    const container = document.getElementById('sec-produtos');
    if(!container) return;

    // Verifica se o Grid já existe para não apagar o cabeçalho a cada atualização
    let gridProdutos = document.getElementById('grid-produtos-realtime');
    
    if(!gridProdutos) {
        // INICIALIZAÇÃO VISUAL (Roda apenas na primeira vez)
        container.innerHTML = `
            <div class="bg-purple-50 border border-purple-200 p-3 rounded-lg flex items-center gap-3 mb-4 shadow-sm">
                <span class="text-2xl">🛒</span>
                <div>
                    <p class="text-[10px] font-bold text-purple-800 uppercase">Curadoria Atlivio</p>
                    <p class="text-[9px] text-purple-600">Produtos e serviços validados.</p>
                </div>
            </div>`;
        
        gridProdutos = document.createElement('div');
        gridProdutos.id = 'grid-produtos-realtime';
        gridProdutos.className = 'grid grid-cols-2 gap-3 pb-20'; // pb-20 para não ficar atrás do menu
        container.appendChild(gridProdutos);
    }

    // --- QUERY FIREBASE ---
    // Busca produtos ordenados pela data de criação (mais recentes primeiro)
    const q = query(collection(db, "produtos"), orderBy("created_at", "desc"));

    onSnapshot(q, (snap) => {
        gridProdutos.innerHTML = "";
        
        if(snap.empty) {
            gridProdutos.innerHTML = `
                <div class="col-span-2 text-center py-10 text-gray-400 text-xs flex flex-col items-center">
                    <span class="text-4xl grayscale opacity-50 mb-2">📦</span>
                    <p>A vitrine está sendo montada.</p>
                </div>`;
        } else {
            snap.forEach(d => {
                const prod = d.data();
                
                // Formatação de segurança para imagem quebrada
                const imagemHtml = prod.imagem 
                    ? `<img src="${prod.imagem}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">` 
                    : '<span class="text-2xl">📷</span>';

                // Renderiza Card
                gridProdutos.innerHTML += `
                    <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full group hover:shadow-md transition">
                        <div class="h-28 bg-gray-50 rounded-lg mb-2 overflow-hidden flex items-center justify-center relative">
                             ${imagemHtml}
                             <div class="absolute top-1 right-1 bg-white/90 backdrop-blur px-2 py-0.5 rounded text-[8px] font-bold shadow-sm">
                                NOVO
                             </div>
                        </div>
                        
                        <h4 class="font-bold text-xs text-gray-800 leading-tight mb-1 line-clamp-2 min-h-[2.5em]">${prod.nome || 'Produto sem nome'}</h4>
                        <p class="text-[10px] text-gray-400 mb-3 line-clamp-2">${prod.descricao || 'Sem descrição'}</p>
                        
                        <div class="mt-auto flex justify-between items-center pt-2 border-t border-gray-50">
                            <span class="font-black text-sm text-purple-700">R$ ${prod.preco || '0,00'}</span>
                            <a href="${prod.link_checkout || '#'}" target="_blank" class="bg-purple-600 text-white text-[9px] font-bold px-3 py-1.5 rounded-lg uppercase hover:bg-purple-700 transition">
                                Comprar
                            </a>
                        </div>
                    </div>`;
            });
        }
    });
}

// --- MONITORAMENTO SEGURO ---
setInterval(() => {
    const sec = document.getElementById('sec-produtos');
    
    // 1. A seção existe? 
    // 2. Ela está visível? 
    // 3. O listener AINDA NÃO está ativo?
    if(sec && !sec.classList.contains('hidden') && !listenerLojaAtivo) {
        console.log("Auditor: Ativando vitrine (Loja) em tempo real.");
        carregarProdutos();
        listenerLojaAtivo = true; // Trava o listener para não duplicar
    }
}, 2000);
