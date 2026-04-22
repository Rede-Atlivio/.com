import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-canal-atlivio'); // ID sincronizado com seu admin.html
    if (!container) return;

    container.innerHTML = `
        <div class="flex justify-between items-center mb-6 animate-fade">
            <div>
                <h2 class="text-2xl font-black text-white uppercase italic tracking-tighter">📺 Gerenciar Canal Atlivio</h2>
                <p class="text-xs text-emerald-500 font-bold uppercase tracking-widest">Postagens Diretas para o Cliente</p>
            </div>
            <button onclick="window.addConteudoCanal()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-black shadow-lg flex items-center gap-2 text-xs uppercase transition active:scale-95">
                <i data-lucide="plus-circle"></i> NOVO CONTEÚDO / ADS
            </button>
        </div>
        <div id="canal-admin-grid" class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <p class="text-gray-500">Sincronizando com o app...</p>
        </div>
    `;
    
    // 🚀 FUNÇÃO PARA POSTAR (COM DNA DE ADS)
    window.addConteudoCanal = async () => {
        const title = prompt("Título do Vídeo/Oportunidade:");
        const url = prompt("Link do YouTube (Embed):");
        const categoria = prompt("Categoria: onboarding, regras, estrategia ou ads?");
        const isAds = confirm("Este vídeo é um ADS Recompensado (Paga ATLIX)?");
        
        let recompensa = 0;
        let abaDestino = "missoes";

        if (isAds) {
            recompensa = parseInt(prompt("Quanto ATLIX o usuário ganha? (Ex: 2)", "2")) || 0;
            abaDestino = prompt("Para qual aba o botão deve levar? (home, servicos, empregos, loja)", "missoes");
        }

        if(!title || !url) return;
        
        let embedUrl = url;
        if(url.includes("watch?v=")) embedUrl = url.replace("watch?v=", "embed/").split("&")[0];
        if(url.includes("youtu.be/")) embedUrl = url.replace("youtu.be/", "www.youtube.com/embed/");
        if(url.includes("shorts/")) embedUrl = url.replace("shorts/", "embed/");

        await addDoc(collection(window.db, "canal_atlivio"), { 
            title, 
            url: embedUrl, 
            category: categoria || "novidades",
            is_ads: isAds,
            recompensa_atlix: recompensa,
            target_aba: abaDestino,
            created_at: serverTimestamp() 
        });
        
        alert("✅ Postado com sucesso no Canal do Cliente!");
        loadCanalAdmin();
    };

    window.deleteConteudoCanal = async (id) => {
        if(confirm("Excluir esta postagem do canal do cliente?")) {
            await deleteDoc(doc(window.db, "canal_atlivio", id));
            loadCanalAdmin();
        }
    };

    loadCanalAdmin();
}

async function loadCanalAdmin() {
    const grid = document.getElementById('canal-admin-grid');
    const q = query(collection(window.db, "canal_atlivio"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    
    grid.innerHTML = "";
    if(snap.empty) { grid.innerHTML = `<p class="text-gray-500">Nenhum conteúdo no canal.</p>`; return; }

    snap.forEach(d => {
        const data = d.data();
        const adsBadge = data.is_ads ? `<span class="bg-emerald-500 text-white text-[8px] px-2 py-0.5 rounded-full">ADS +${data.recompensa_atlix}</span>` : "";
        
        grid.innerHTML += `
            <div class="bg-slate-900/50 border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative group hover:border-emerald-500/30 transition-all">
                <div class="relative pt-[56.25%]">
                    <iframe class="absolute inset-0 w-full h-full pointer-events-none" src="${data.url}" frameborder="0"></iframe>
                </div>
                <div class="p-5">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-[9px] font-black text-gray-500 uppercase">${data.category}</span>
                        ${adsBadge}
                    </div>
                    <h3 class="font-black text-white text-sm uppercase italic">${data.title}</h3>
                    <button onclick="window.deleteConteudoCanal('${d.id}')" class="mt-4 w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white py-2 rounded-xl text-[10px] font-bold transition">
                        REMOVER DO CANAL
                    </button>
                </div>
            </div>
        `;
    });
}
