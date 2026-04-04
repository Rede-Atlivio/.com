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

        // 💊 SISTEMA DE FILTROS (Pílulas de Categoria)
        const filterBar = document.createElement('div');
        filterBar.className = "flex gap-2 overflow-x-auto px-2 mb-4 no-scrollbar pb-2";
        filterBar.innerHTML = `
            <button onclick="window.filtrarProdutos('todos')" class="filter-pill active">TUDO</button>
            <button onclick="window.filtrarProdutos('vantagens')" class="filter-pill">🚀 VANTAGENS</button>
            <button onclick="window.filtrarProdutos('utilidades')" class="filter-pill">💡 UTILIDADES</button>
            <button onclick="window.filtrarProdutos('curiosidades')" class="filter-pill">🔍 CURIOSIDADES</button>
        `;
        container.appendChild(filterBar);

        const grid = document.createElement('div');
        grid.className = "grid grid-cols-2 gap-3 px-2 pb-24";

        snap.forEach(d => {
            const prod = d.data();
            const id = d.id;
            const jaTem = (window.userProfile?.my_vault || []).includes(id);

            // ⭐ Lógica de Estrelas (Nível)
            let estrelas = "";
            for(let i=0; i < (prod.nivel_produto || 1); i++) { estrelas += "⭐"; }

            grid.innerHTML += `
                <div class="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group product-card" data-cat="${prod.categoria || 'vantagens'}">
                    
                    ${prod.tag ? `<div class="absolute top-2 left-2 bg-amber-400 text-[7px] font-black px-2 py-1 rounded-full z-10 uppercase shadow-sm">${prod.tag}</div>` : ""}
                    ${prod.vendas_fake > 0 ? `<div class="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-[6px] font-bold px-2 py-1 rounded-full z-10 text-gray-500 border border-gray-100 flex items-center gap-1"><i data-lucide="users" class="w-2 h-2"></i> +${prod.vendas_fake}</div>` : ""}

                    <div class="h-24 mb-2 rounded-xl overflow-hidden bg-gray-50 relative">
                        <img src="${prod.img}" class="w-full h-full object-cover">
                        <div class="absolute bottom-1 right-1 flex gap-1">
                            <span class="bg-black/60 text-white text-[6px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-0.5 italic">⏱️ ${prod.tempo_consumo || '2 min'}</span>
                            <span class="bg-black/60 text-white text-[6px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">${estrelas}</span>
                        </div>
                    </div>

                    <p class="text-[7px] text-emerald-600 font-black uppercase mb-1 leading-tight line-clamp-1 italic">✅ ${prod.resultado_principal || 'Aproveite agora'}</p>
                    
                    <h4 class="font-black text-[10px] text-slate-800 leading-tight h-7 line-clamp-2">${prod.nome}</h4>
                    
                    ${prod.preco > 0 ? `<p class="text-[7px] text-gray-300 line-through font-bold mt-1 uppercase italic">Ref: R$ ${parseFloat(prod.preco).toFixed(2)}</p>` : ""}

                    <div class="flex justify-between items-end mt-2 pt-2 border-t border-gray-50">
                        <div class="flex flex-col">
                            <span class="text-[7px] text-gray-400 uppercase font-black tracking-tighter">Investimento</span>
                            <span class="font-black text-purple-600 text-xs tracking-tighter">${prod.preco_atlix || 0} ATLIX</span>
                        </div>
                        <button onclick="${jaTem ? `window.abrirCofreConteudo('${id}')` : `window.abrirPreviewProduto('${id}')`}"
                                class="${jaTem ? 'bg-emerald-500' : 'bg-purple-600'} text-white px-2 py-2 rounded-lg text-[9px] font-black uppercase shadow-md transition-all active:scale-95">
                            ${jaTem ? 'ACESSAR' : 'LIBERAR'}
                        </button>
                    </div>
                </div>`;
        });
        container.appendChild(grid);
        // Atualiza ícones se o Lucide estiver presente
        if (typeof lucide !== 'undefined') lucide.createIcons();

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

// 🌍 FUNÇÃO DE FILTRAGEM (Lógica Interna)
window.filtrarProdutos = (cat) => {
    // 1. Estilo nos botões
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.remove('active', 'bg-purple-600', 'text-white');
        btn.classList.add('bg-gray-100', 'text-gray-500');
    });

    const btnAtivo = Array.from(document.querySelectorAll('.filter-pill')).find(b => b.innerText.toLowerCase().includes(cat.toLowerCase()));
    if(btnAtivo) {
        btnAtivo.classList.add('active', 'bg-purple-600', 'text-white');
        btnAtivo.classList.remove('bg-gray-100', 'text-gray-500');
    }

    // 2. Filtra os cards
    document.querySelectorAll('.product-card').forEach(card => {
        if(cat === 'todos' || card.getAttribute('data-cat') === cat) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
};

// 👁️ MOTOR DE DESEJO: ABRE PREVIEW ANTES DE COMPRAR
window.abrirPreviewProduto = async (id) => {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const snap = await getDoc(doc(window.db, "products", id));
    if(!snap.exists()) return;
    const p = snap.data();

    // 🎥 Lógica de Mídia: Se tiver vídeo, cria o player, senão usa a imagem
    const mediaHTML = p.url_video 
        ? `<div class="relative h-56 bg-black overflow-hidden border-b-4 border-purple-600">
             <iframe src="${p.url_video}" class="w-full h-full pointer-events-auto" frameborder="0" allow="autoplay; encrypted-media"></iframe>
             <button onclick="this.closest('#modal-preview-venda').remove()" class="absolute top-4 right-4 bg-black/50 text-white w-8 h-8 rounded-full font-bold z-50">×</button>
           </div>`
        : `<div class="relative h-48 bg-slate-100">
             <img src="${p.img}" class="w-full h-full object-cover">
             <button onclick="this.closest('#modal-preview-venda').remove()" class="absolute top-4 right-4 bg-black/50 text-white w-8 h-8 rounded-full font-bold z-50">×</button>
           </div>`;

    const modal = document.createElement('div');
    modal.id = 'modal-preview-venda';
    modal.className = "fixed inset-0 z-[10005] bg-black/95 flex flex-col items-center justify-center p-4 animate-fadeIn";
    modal.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col animate-slideUp">
            ${mediaHTML}
            <div class="p-6 text-center">
            <div class="p-6 text-center">
                <p class="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">${p.headline || ''}</p>
                <h3 class="text-xl font-black text-slate-800 leading-tight mb-3">${p.nome}</h3>
                
                <div class="bg-emerald-50 p-3 rounded-2xl mb-4">
                    <p class="text-[10px] text-emerald-700 font-bold italic">"O que você vai ganhar: ${p.resultado_principal || 'Acesso imediato à vantagem'}"</p>
                </div>

                <div class="flex justify-center gap-4 mb-6">
                    <div class="text-center">
                        <p class="text-[8px] text-gray-400 font-black uppercase">Consumo</p>
                        <p class="text-xs font-bold text-slate-600">⏱️ ${p.tempo_consumo || '2 min'}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-[8px] text-gray-400 font-black uppercase">Dificuldade</p>
                        <p class="text-xs font-bold text-slate-600">${p.nivel_produto === 3 ? '⭐⭐⭐' : p.nivel_produto === 2 ? '⭐⭐' : '⭐'}</p>
                    </div>
                </div>

                <button onclick="window.comprarComAtlix('${id}', ${p.preco_atlix}, '${p.tipo}'); this.closest('#modal-preview-venda').remove();" 
                        class="w-full bg-purple-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg shadow-purple-200 active:scale-95 transition">
                    DESBLOQUEAR POR ${p.preco_atlix} ATLIX 🪙
                </button>
                <p class="text-[8px] text-gray-400 mt-3 uppercase font-bold">O valor será descontado do seu saldo de bônus ou recarga.</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

// 🔗 Soldagem Global
window.carregarProdutos = carregarProdutos;

console.log("🚀 Módulo de Produtos carregado com sucesso no Navegador!");
