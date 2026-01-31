import { db } from '../app.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function carregarProdutos() {
    console.log("🛒 Loja Virtual Iniciada...");
    const container = document.getElementById('sec-produtos');
    if(!container) return;

    container.innerHTML = `<div class="text-center py-10"><div class="loader mx-auto"></div></div>`;

    try {
        const q = query(collection(db, "products"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);

        container.innerHTML = "";
        
        if (snap.empty) {
            container.innerHTML = `<div class="text-center py-10 opacity-50"><span class="text-4xl">📦</span><p class="text-xs text-gray-400 mt-2">Em breve novidades.</p></div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = "grid grid-cols-2 gap-3 px-2 pb-20";

        snap.forEach(doc => {
            const prod = doc.data();
            
            // Lógica de Preço
            let precoHtml = `<span class="font-black text-gray-800 text-sm">R$ ${parseFloat(prod.preco).toFixed(2)}</span>`;
            if (prod.preco_promo && parseFloat(prod.preco_promo) > 0) {
                precoHtml = `
                    <div class="flex flex-col leading-tight">
                        <span class="text-[10px] text-gray-400 line-through">R$ ${parseFloat(prod.preco).toFixed(2)}</span>
                        <span class="font-black text-green-600 text-sm">R$ ${parseFloat(prod.preco_promo).toFixed(2)}</span>
                    </div>
                `;
            }

            // Etiqueta
            let tagHtml = "";
            if(prod.tag) {
                tagHtml = `<div class="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded shadow-sm uppercase">${prod.tag}</div>`;
            }

            grid.innerHTML += `
                <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-lg transition">
                    ${tagHtml}
                    <div class="h-28 mb-2 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden relative">
                        <img src="${prod.img || 'https://placehold.co/150'}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${prod.nome}">
                        ${prod.tipo === 'virtual' ? '<span class="absolute bottom-1 left-1 bg-black/50 text-white text-[8px] px-1 rounded backdrop-blur-sm">☁️ Digital</span>' : ''}
                    </div>
                    <div>
                        <h4 class="font-bold text-xs text-gray-800 leading-tight mb-1 line-clamp-2 min-h-[2.5em]">${prod.nome}</h4>
                        <div class="flex justify-between items-center mt-2">
                            ${precoHtml}
                            <a href="${prod.link}" target="_blank" class="bg-slate-900 text-white p-2 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-700 transition shadow-md">
                                COMPRAR
                            </a>
                        </div>
                    </div>
                </div>
            `;
        });

        container.appendChild(grid);

    } catch (e) {
        console.error("Erro loja:", e);
        container.innerHTML = `<p class="text-center text-red-400 text-xs">Erro ao carregar loja.</p>`;
    }
}

window.carregarProdutos = carregarProdutos;
const tabBtn = document.getElementById('tab-produtos');
if(tabBtn) tabBtn.addEventListener('click', carregarProdutos);
