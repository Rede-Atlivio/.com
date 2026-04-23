import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-canal_atlivio'); // Mantenha o ID que está no seu admin.html
    if (!container) return;

    container.innerHTML = `
        <div class="flex justify-between items-center mb-6 animate-fade">
            <div>
                <h2 class="text-2xl font-black text-white uppercase italic tracking-tighter">📺 Canal ATLIVIO (CLIENTE)</h2>
                <p class="text-xs text-emerald-500 font-bold uppercase tracking-widest">Gerenciador de Conteúdo e ADS Recompensado</p>
            </div>
            <button onclick="window.addTutorialCanal()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-black shadow-lg flex items-center gap-2 text-xs uppercase transition active:scale-95">
                <i data-lucide="video"></i> NOVO VÍDEO / ADS
            </button>
        </div>
        <div id="canal-atlivio-grid" class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <p class="text-gray-500">Carregando canal do cliente...</p>
        </div>
    `;
    
    // 🚀 FUNÇÃO DE POSTAGEM COM DNA DE MONETIZAÇÃO
    window.addTutorialCanal = async () => {
        const title = prompt("Título do Conteúdo:");
        const url = prompt("Link do YouTube:");
        if(!title || !url) return;

        // 🧠 Inteligência de ADS
        const isAds = confirm("Este conteúdo é um ADS Recompensado (Paga ATLIX)?");
        let recompensa = 0;
        let abaDestino = "missoes";
        let categoria = "onboarding";

       // 🧠 Inteligência de Direcionamento e Texto (Corrigida)
        let categoria = "novidades"; 
        
        if (isAds) {
            categoria = "ads";
            recompensa = parseInt(prompt("Quanto ATLIX este vídeo vai pagar?", "2")) || 0;
        } else {
            categoria = prompt("Escolha a Categoria:\n- comece_aqui\n- avisos\n- novidades\n- lucro", "novidades");
        }

        const btnText = prompt("Texto do Botão (Ex: APROVEITAR OFERTA, IR PARA CARTEIRA, COMEÇAR):", isAds ? "🎁 RESGATAR RECOMPENSA" : "VER AGORA ➔");
        const abaDestino = prompt("ID da Aba de Destino (home, loja, empregos, missoes, servicos, finance):", "missoes");

        let embedUrl = url;
        if(url.includes("watch?v=")) embedUrl = url.replace("watch?v=", "embed/").split("&")[0];
        if(url.includes("youtu.be/")) embedUrl = url.replace("youtu.be/", "www.youtube.com/embed/");
        if(url.includes("shorts/")) embedUrl = url.replace("shorts/", "embed/");

        try {
            // 🛰️ SOLDA: Agora salva na coleção correta do Canal
            await addDoc(collection(window.db, "canal_atlivio"), { 
                title, 
                url: embedUrl, 
                category: categoria,
                is_ads: isAds,
                recompensa_atlix: recompensa,
                button_text: btnText, // <-- NOVO CAMPO SALVO
                target_aba: abaDestino,
                created_at: serverTimestamp() 
            });
            alert("✅ Publicado no Canal com sucesso!");
            loadTutorials();
        } catch (e) { alert("Erro ao salvar: " + e.message); }
    };

    window.deleteTutorial = async (id) => {
        if(confirm("Excluir este conteúdo do canal do cliente?")) {
            await deleteDoc(doc(window.db, "canal_atlivio", id));
            loadTutorials();
        }
    };

    loadTutorials();
}

async function loadTutorials() {
    const grid = document.getElementById('canal-atlivio-grid');
    // 🛰️ SOLDA: Busca apenas os dados do Canal do Cliente
    const q = query(collection(window.db, "canal_atlivio"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    
    grid.innerHTML = "";
    if(snap.empty) { grid.innerHTML = `<p class="text-gray-500 py-10">O canal está vazio.</p>`; return; }

    snap.forEach(d => {
        const data = d.data();
        const badgeAds = data.is_ads ? `<span class="bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded ml-2">ADS +${data.recompensa_atlix}</span>` : "";
        
        grid.innerHTML += `
            <div class="bg-slate-900/50 border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative group hover:border-emerald-500/30 transition-all duration-500">
               <div class="relative pt-[56.25%] bg-black">
    <iframe 
        class="absolute inset-0 w-full h-full" 
        src="${data.url}?rel=0&modestbranding=1&iv_load_policy=3&controls=1" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
    </iframe>
</div>
                <div class="p-5 flex justify-between items-start">
                    <div>
                        <div class="flex items-center">
                            <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">${data.category}</span>
                            ${badgeAds}
                        </div>
                        <h3 class="font-black text-white text-sm leading-tight mt-1 uppercase italic">${data.title}</h3>
                    </div>
                    <button onclick="window.deleteTutorial('${d.id}')" class="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-xl transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    });
}
