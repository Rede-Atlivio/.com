import { db, auth } from '../config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function carregarProdutos() {
    console.log("🛒 Loja Virtual V2026: Sincronizando Vitrine...");
    const container = document.getElementById('sec-produtos');
    if(!container) return;

    container.innerHTML = `<div class="text-center py-10"><div class="loader mx-auto border-purple-500"></div></div>`;

    try {
        const q = query(collection(db, "products"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);

        container.innerHTML = "";
        
        if (snap.empty) {
            container.innerHTML = `<div class="text-center py-20 opacity-50"><span class="text-4xl">📦</span><p class="text-[10px] text-gray-400 mt-2 uppercase font-black">Em breve novidades na loja.</p></div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = "grid grid-cols-2 gap-3 px-2 pb-24";

        snap.forEach(docSnap => {
            const prod = docSnap.data();
            const prodId = docSnap.id;
            
            // 🛡️ VERIFICAÇÃO DE POSSE
            const jaComprou = window.userProfile?.my_vault?.includes(prodId);

            // 💰 Lógica de Preço em ATLIX
            let precoHtml = `
                <div class="flex flex-col leading-tight">
                    <span class="text-[8px] text-gray-400 uppercase font-black">Investimento</span>
                    <span class="font-black text-purple-600 text-sm">${prod.preco_atlix || 0} ATLIX</span>
                </div>
            `;

            // 🔘 Botão Inteligente (Acesso vs Compra)
            let botaoHtml = "";
            if (jaComprou) {
                botaoHtml = `
                    <button onclick="window.abrirCofreConteudo('${prodId}')" class="bg-emerald-500 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase shadow-md animate-pulse">
                        ACESSAR 🔓
                    </button>`;
            } else {
                botaoHtml = `
                    <button onclick="window.comprarComAtlix('${prodId}', ${prod.preco_atlix}, '${prod.tipo}')" class="bg-purple-600 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-purple-500 transition shadow-md">
                        LIBERAR 💰
                    </button>`;
            }

            // 🏷️ Etiqueta de Headline
            let headlineHtml = prod.headline ? `<p class="text-[8px] text-purple-500 font-black uppercase mb-1 leading-none italic line-clamp-1">${prod.headline}</p>` : "";

            grid.innerHTML += `
                <div class="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                    ${prod.tag ? `<div class="absolute top-2 left-2 bg-amber-400 text-slate-900 text-[7px] font-black px-2 py-0.5 rounded-full z-10 shadow-sm uppercase">${prod.tag}</div>` : ""}

                    <div class="h-24 mb-3 flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden relative">
                        <img src="${prod.img || 'https://placehold.co/150'}" class="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt="${prod.nome}">
                        ${prod.tipo === 'virtual' ? '<div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div><span class="absolute bottom-1 right-2 text-white text-[16px]">🎓</span>' : ''}
                    </div>

                    <div class="space-y-1">
                        ${headlineHtml}
                        <h4 class="font-black text-[11px] text-slate-800 leading-tight line-clamp-2 h-7">${prod.nome}</h4>
                        <div class="flex justify-between items-end mt-3 pt-2 border-t border-slate-50">
                            ${jaComprou ? '<span class="text-[9px] text-emerald-600 font-bold italic">Liberado</span>' : precoHtml}
                            ${botaoHtml}
                        </div>
                    </div>
                </div>
            `;
        });

        container.appendChild(grid);

    } catch (e) {
        console.error("Erro na Loja:", e);
        container.innerHTML = `<p class="text-center text-red-400 text-xs">Erro ao conectar com o estoque.</p>`;
    }
}

// 🔐 SOLDAGEM GLOBAL
window.carregarProdutos = carregarProdutos;

// Gatilho de aba: Tenta o ID de botão da loja ou o padrão
document.getElementById('tab-loja')?.addEventListener('click', carregarProdutos);
