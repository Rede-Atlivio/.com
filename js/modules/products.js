import { db } from '../config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function carregarProdutos() {
    const container = document.getElementById('sec-produtos');
    if(!container) return;

    container.innerHTML = `<div class="py-10 text-center"><div class="loader mx-auto border-purple-500"></div></div>`;

    try {
        const q = query(collection(db, "products"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        container.innerHTML = "";

        if (snap.empty) {
            container.innerHTML = `<p class="text-center py-20 text-gray-400 uppercase text-[10px] font-black italic">Estoque em reposição...</p>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = "grid grid-cols-2 gap-3 px-2 pb-24";

        snap.forEach(d => {
            const prod = d.data();
            const id = d.id;
            // 🛡️ Checa posse (Garantido pela blindagem do app.js)
            // 🛡️ Blindagem: Se o my_vault não existir, o JS entende como lista vazia e não trava
            const jaTem = (window.userProfile?.my_vault || []).includes(id);

            grid.innerHTML += `
                <div class="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    ${prod.tag ? `<div class="absolute top-2 left-2 bg-amber-400 text-[7px] font-black px-2 py-1 rounded-full z-10 uppercase">${prod.tag}</div>` : ""}
                    <div class="h-24 mb-2 rounded-xl overflow-hidden bg-gray-50">
                        <img src="${prod.img}" class="w-full h-full object-cover">
                    </div>
                    <p class="text-[8px] text-purple-600 font-black uppercase mb-1 truncate">${prod.headline || ''}</p>
                    <h4 class="font-black text-[10px] text-slate-800 leading-tight h-7 line-clamp-2">${prod.nome}</h4>
                    <div class="flex justify-between items-end mt-3 pt-2 border-t border-gray-50">
                        <div class="flex flex-col">
                            <span class="text-[7px] text-gray-400 uppercase font-black">Investimento</span>
                            <span class="font-black text-purple-600 text-xs">${prod.preco_atlix || 0} ATLIX</span>
                        </div>
                        <button onclick="${jaTem ? `window.abrirCofreConteudo('${id}')` : `window.comprarComAtlix('${id}', ${prod.preco_atlix}, '${prod.tipo}')`}" 
                                class="${jaTem ? 'bg-emerald-500' : 'bg-purple-600'} text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase shadow-md">
                            ${jaTem ? 'ACESSAR' : 'LIBERAR'}
                        </button>
                    </div>
                </div>`;
        });
        container.appendChild(grid);
    } catch (e) { console.error("Erro Vitrine:", e); }
}
// 🔗 Soldagem Global
window.carregarProdutos = carregarProdutos;
