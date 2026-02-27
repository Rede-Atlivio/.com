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
        if(url.includes("watch?v=")) embedUrl = url.replace("watch?v=", "embed/");
        if(url.includes("youtu.be/")) embedUrl = url.replace("youtu.be/", "www.youtube.com/embed/");

        await addDoc(collection(window.db, "tutorials"), { title, url: embedUrl, created_at: serverTimestamp() });
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
            <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg relative group">
                <iframe class="w-full h-48" src="${data.url}" frameborder="0" allowfullscreen></iframe>
                <div class="p-4 flex justify-between items-center">
                    <h3 class="font-bold text-white">${data.title}</h3>
                    <button onclick="window.deleteTutorial('${d.id}')" class="text-red-500 hover:text-red-400 font-bold">🗑️</button>
                </div>
            </div>
        `;
    });
}
