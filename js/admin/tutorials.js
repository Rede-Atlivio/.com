import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-tutorials');
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6 animate-fade">
            <div>
                <h2 class="text-2xl font-black text-white uppercase italic tracking-tighter">📺 Canal ATLIVIO</h2>
                <p class="text-xs text-gray-500 font-bold uppercase tracking-widest">Central de Educação e Retenção</p>
            </div>
            <button onclick="window.addTutorial()" class="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-black shadow-lg flex items-center gap-2 text-xs uppercase transition active:scale-95">
                <i data-lucide="video"></i> NOVO CONTEÚDO
            </button>
        </div>
        <div id="tutorials-grid" class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <p class="text-gray-500">Carregando vídeos...</p>
        </div>
    `;
    
    window.addTutorial = async () => {
        const title = prompt("Título do Vídeo:");
        const url = prompt("Link do YouTube (Embed ou Watch):");
        if(!title || !url) return;
        
       let embedUrl = url;
        if(url.includes("watch?v=")) embedUrl = url.replace("watch?v=", "embed/").split("&")[0];
        if(url.includes("youtu.be/")) embedUrl = url.replace("youtu.be/", "www.youtube.com/embed/");
        if(url.includes("shorts/")) embedUrl = url.replace("shorts/", "embed/");

        await addDoc(collection(window.db, "tutorials"), { 
            title, 
            url: embedUrl, 
            type: "canal_atlivio", 
            created_at: serverTimestamp() 
        });
        loadTutorials();
    };

    window.deleteTutorial = async (id) => {
        if(confirm("Excluir vídeo?")) {
            await deleteDoc(doc(window.db, "tutorials", id));
            loadTutorials();
        }
    };

    loadTutorials();
}

async function loadTutorials() {
    const grid = document.getElementById('tutorials-grid');
    const q = query(collection(window.db, "tutorials"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    
    grid.innerHTML = "";
    if(snap.empty) { grid.innerHTML = `<p class="text-gray-500">Nenhum tutorial cadastrado.</p>`; return; }

    snap.forEach(d => {
        const data = d.data();
        grid.innerHTML += `
            <div class="bg-slate-900/50 border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative group hover:border-red-500/30 transition-all duration-500">
                <div class="relative pt-[56.25%]">
                    <iframe class="absolute inset-0 w-full h-full" src="${data.url}" frameborder="0" allowfullscreen></iframe>
                </div>
                <div class="p-5 flex justify-between items-start">
                    <div>
                        <span class="text-[9px] font-black text-red-500 uppercase tracking-widest">Conteúdo Oficial</span>
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
