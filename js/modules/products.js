import { db } from '../app.js';
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Evita duplicidade de listeners
let listenerProdutosAtivo = false;

// Função chamada automaticamente pelo app.js ou pelo intervalo
setTimeout(() => {
    carregarProdutos();
}, 1500);

export function carregarProdutos() {
    const container = document.getElementById('sec-produtos');
    
    // Se a aba não existe ou o listener já roda, para.
    if(!container || listenerProdutosAtivo) return;

    // Cria a estrutura da grade se não existir
    let grid = document.getElementById('grid-produtos-realtime');
    if(!grid) {
        container.innerHTML = `
            <div class="mb-4 flex items-center justify-between">
                <div>
                    <h3 class="font-black text-slate-700 text-sm uppercase italic">Seleção Atlivio</h3>
                    <p class="text-[10px] text-gray-400">Curadoria de alta qualidade.</p>
                </div>
                <span class="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded">Verificados</span>
            </div>
            <div id="grid-produtos-realtime" class="grid grid-cols-2 gap-3 pb-20"></div>
        `;
        grid = document.getElementById('grid-produtos-realtime');
    }

    const q = query(collection(db, "produtos"), orderBy("created_at", "desc"));

    onSnapshot(q, (snap) => {
        listenerProdutosAtivo = true;
        grid.innerHTML = "";
        
        if(snap.empty) {
            grid.innerHTML = `
                <div class="col-span-2 text-center py-10 text-gray-400 text-xs flex flex-col items-center border border-dashed border-gray-200 rounded-xl">
                    <span class="text-4xl grayscale opacity-50 mb-2">🛒</span>
                    <p>Nenhum produto recomendado hoje.</p>
                </div>`;
        } else {
            snap.forEach(d => {
                const prod = d.data();
                
                // Renderiza o Card
                grid.innerHTML += `
                    <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full group hover:shadow-md transition">
                        <div class="h-32 bg-gray-100 rounded-lg mb-2 overflow-hidden relative">
                            <img src="${prod.imagem}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500" onerror="this.src='https://placehold.co/400x400?text=Foto'">
                            ${prod.destaque ? '<div class="absolute top-1 right-1 bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded text-[8px] font-black shadow-sm">TOP</div>' : ''}
                        </div>
                        
                        <h4 class="font-bold text-xs text-gray-800 leading-tight mb-1 line-clamp-2 h-8">${prod.nome}</h4>
                        <p class="text-[9px] text-gray-400 mb-2 line-clamp-1">${prod.categoria || 'Geral'}</p>
                        
                        <div class="mt-auto flex justify-between items-center pt-2 border-t border-gray-50">
                            <span class="font-black text-sm text-purple-700">R$ ${prod.preco}</span>
                            <a href="${prod.link}" target="_blank" class="bg-purple-600 text-white text-[9px] font-bold px-3 py-1.5 rounded-lg uppercase hover:bg-purple-700 transition">
                                Ver
                            </a>
                        </div>
                    </div>`;
            });
        }
    });
}

// Garante carregamento ao trocar de aba
const tabLoja = document.getElementById('tab-loja');
if(tabLoja) {
    tabLoja.addEventListener('click', carregarProdutos);
}
