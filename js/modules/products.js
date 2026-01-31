import { db } from '../app.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- FUNÇÃO DE CARREGAMENTO (AGORA DO BANCO) ---
export async function carregarProdutos() {
    console.log("🛒 Iniciando módulo de Produtos (Dinâmico)...");
    const container = document.getElementById('sec-produtos');
    if(!container) return;

    container.innerHTML = `<div class="text-center py-10"><div class="loader mx-auto"></div></div>`;

    try {
        const q = query(collection(db, "products"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);

        container.innerHTML = "";
        
        if (snap.empty) {
            container.innerHTML = `
                <div class="text-center py-10 opacity-50">
                    <span class="text-4xl">📦</span>
                    <p class="text-xs text-gray-400 mt-2">Nenhum produto recomendado hoje.</p>
                </div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = "grid grid-cols-2 gap-3 px-2";

        snap.forEach(doc => {
            const prod = doc.data();
            grid.innerHTML += `
                <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                    <div class="h-24 mb-2 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                        <img src="${prod.img || 'https://placehold.co/100'}" class="w-full h-full object-cover" alt="${prod.nome}">
                    </div>
                    <div>
                        <h4 class="font-bold text-xs text-gray-800 leading-tight mb-1 line-clamp-2">${prod.nome}</h4>
                        <p class="text-[10px] text-gray-500 mb-2 truncate">${prod.desc}</p>
                        <div class="flex justify-between items-center">
                            <span class="font-black text-green-600 text-sm">R$ ${parseFloat(prod.preco).toFixed(2)}</span>
                            <a href="${prod.link}" target="_blank" class="bg-blue-100 text-blue-700 p-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-200 transition">Ver</a>
                        </div>
                    </div>
                </div>
            `;
        });

        container.appendChild(grid);

    } catch (e) {
        console.error("Erro produtos:", e);
        container.innerHTML = `<p class="text-center text-red-400 text-xs">Erro ao carregar loja.</p>`;
    }
}

// EXPORTAÇÃO GLOBAL
window.carregarProdutos = carregarProdutos;
const tabBtn = document.getElementById('tab-produtos'); // Se existir botão de aba
if(tabBtn) tabBtn.addEventListener('click', carregarProdutos);
